import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Credit cost table
const CREDIT_COSTS: Record<string, { credits: number; usd: number }> = {
  "image_gen_pro": { credits: 5, usd: 0.05 },
  "image_gen_fast": { credits: 1, usd: 0.01 },
  "text_gen_1k": { credits: 0.5, usd: 0.005 },
  "memory_analysis": { credits: 3, usd: 0.03 },
  "page_assembly": { credits: 2, usd: 0.02 },
  "chat_message": { credits: 0.5, usd: 0.005 },
  "intent_classify": { credits: 0.1, usd: 0.001 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, projectId, selectedAssetId } = await req.json();
    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── Full DNA context ────────────────────────────────
    let dnaContext = "";
    let projectName = "";
    if (projectId) {
      const { data: project } = await serviceClient
        .from("projects").select("name, niche, product, description")
        .eq("id", projectId).single();
      const { data: dna } = await serviceClient
        .from("project_dna").select("identity, audience, strategy, visual, version")
        .eq("project_id", projectId).order("version", { ascending: false }).limit(1).single();

      if (project) {
        projectName = project.name || "";
        dnaContext = `\n\n## CONTEXTO DO PROJETO "${project.name}"`;
        if (project.niche) dnaContext += `\nNicho: ${project.niche}`;
        if (project.product) dnaContext += `\nProduto: ${project.product}`;
        if (project.description) dnaContext += `\nDescrição: ${project.description}`;
      }
      if (dna) {
        dnaContext += `\n[DNA v${dna.version}]`;
        const id = dna.identity as any;
        const aud = dna.audience as any;
        const str = dna.strategy as any;
        const vis = dna.visual as any;
        if (id?.tom) dnaContext += `\nTom de voz: ${id.tom}`;
        if (id?.personalidade) dnaContext += `\nPersonalidade: ${id.personalidade}`;
        if (aud?.publico_alvo) dnaContext += `\nPúblico-alvo: ${aud.publico_alvo}`;
        if (aud?.dor_principal) dnaContext += `\nDor principal: ${aud.dor_principal}`;
        if (str?.promessa) dnaContext += `\nPromessa: ${str.promessa}`;
        if (vis?.estilo) dnaContext += `\nEstilo visual: ${vis.estilo}`;
      }
    }

    // ═══ PHASE 1: LLM INTENT CLASSIFICATION ═══
    const lastUserMsg = messages[messages.length - 1]?.content || "";
    const intent = await classifyIntentLLM(lastUserMsg, LOVABLE_API_KEY);

    // Log telemetry for classification
    if (projectId) {
      await serviceClient.from("cos_ledger").insert({
        project_id: projectId,
        user_id: user.id,
        provider_used: "gemini-2.5-flash-lite",
        operation_type: "INTENT_CLASSIFY",
        credits_cost: CREDIT_COSTS.intent_classify.credits,
        estimated_usd: CREDIT_COSTS.intent_classify.usd,
        metadata: { intent: intent.intent },
      }).then(() => {}).catch(() => {});
    }

    // ═══ PHASE 2: EXECUTE COMMANDS ═══
    if (intent.intent !== "CHAT_STRATEGY") {
      const result = await executeCommand(
        intent, projectId, user.id, serviceClient, LOVABLE_API_KEY, dnaContext, selectedAssetId
      );

      // Log command telemetry
      if (projectId) {
        const opType = intent.intent === "COMMAND_SPRINT" ? "SPRINT" :
          intent.intent === "COMMAND_GENERATE" ? "TEXT_GEN" :
          intent.intent === "ACTION_APPROVE" ? "CHAT" :
          intent.intent === "ACTION_UPSCALE" ? "TEXT_GEN" :
          intent.intent === "ANALYZE_PATTERNS" ? "MEMORY_ANALYSIS" : "CHAT";
        const cost = opType === "MEMORY_ANALYSIS" ? CREDIT_COSTS.memory_analysis :
          opType === "SPRINT" ? { credits: (intent.params?.quantity || 10) * 2, usd: (intent.params?.quantity || 10) * 0.02 } :
          CREDIT_COSTS.chat_message;

        await serviceClient.from("cos_ledger").insert({
          project_id: projectId,
          user_id: user.id,
          provider_used: "cos-system",
          operation_type: opType,
          credits_cost: cost.credits,
          estimated_usd: cost.usd,
          metadata: { intent: intent.intent, params: intent.params },
        }).then(() => {}).catch(() => {});
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ PHASE 3: STREAMING CONVERSATION ═══
    // Log chat telemetry
    if (projectId) {
      await serviceClient.from("cos_ledger").insert({
        project_id: projectId,
        user_id: user.id,
        provider_used: "gemini-3-flash-preview",
        operation_type: "CHAT",
        credits_cost: CREDIT_COSTS.chat_message.credits,
        estimated_usd: CREDIT_COSTS.chat_message.usd,
      }).then(() => {}).catch(() => {});
    }

    const systemPrompt = `Você é o Assistente COS — especialista em marketing digital e criação de conteúdo.
Seja direto, prático e focado em resultados. Use português brasileiro.

COMANDOS CLI que o usuário pode usar:
- "Faça um sprint de X peças" → Gera em massa
- "Cria um banner 1:1" → Gera criativo específico
- "Aprove o criativo atual" → Muda status para oficial
- "Regere com qualidade" → Nova versão premium
- "Analise meus padrões" → Detecta padrões e sugere DNA updates
${dnaContext}`;

    const response = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos em Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("cos-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ═══ LLM-BASED INTENT CLASSIFICATION ═══
interface IntentResult {
  intent: "COMMAND_SPRINT" | "COMMAND_GENERATE" | "ACTION_APPROVE" | "ACTION_UPSCALE" | "ANALYZE_PATTERNS" | "CHAT_STRATEGY";
  params: Record<string, any>;
}

async function classifyIntentLLM(message: string, apiKey: string): Promise<IntentResult> {
  // Fast regex pre-check for obvious commands
  const quick = quickClassify(message);
  if (quick) return quick;

  // LLM classification for ambiguous messages
  try {
    const resp = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Classifique a intenção do usuário. Retorne APENAS JSON válido:
{ "intent": "TIPO", "params": { ... } }

Tipos possíveis:
- COMMAND_SPRINT: quer gerar em massa (params: quantity, profile, format)
- COMMAND_GENERATE: quer criar 1-5 peças específicas (params: quantity, format, pieceType)
- ACTION_APPROVE: quer aprovar/promover um ativo
- ACTION_UPSCALE: quer regerar com qualidade melhor
- ANALYZE_PATTERNS: quer análise de padrões/memória
- CHAT_STRATEGY: qualquer outra conversa sobre estratégia/marketing

Retorne APENAS o JSON, sem markdown.`
          },
          { role: "user", content: message },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!resp.ok) return { intent: "CHAT_STRATEGY", params: {} };
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "";
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.intent && ["COMMAND_SPRINT", "COMMAND_GENERATE", "ACTION_APPROVE", "ACTION_UPSCALE", "ANALYZE_PATTERNS", "CHAT_STRATEGY"].includes(parsed.intent)) {
        return { intent: parsed.intent, params: parsed.params || {} };
      }
    }
  } catch (e) {
    console.error("Intent classification error:", e);
  }

  return { intent: "CHAT_STRATEGY", params: {} };
}

function quickClassify(msg: string): IntentResult | null {
  const lower = msg.toLowerCase();
  
  const sprintMatch = lower.match(/sprint\s+(?:de\s+)?(\d+)/i) || lower.match(/gere?\s+(\d+)\s+(?:varia|criativ|peça)/i);
  if (sprintMatch) return { intent: "COMMAND_SPRINT", params: { quantity: parseInt(sprintMatch[1]) } };

  if (/aprov[ae]\s+(?:o\s+)?(?:criativo|ativo|isso|esse|este)/i.test(lower)) return { intent: "ACTION_APPROVE", params: {} };
  if (/reger[ae]\s+(?:com|em)\s+qualidade/i.test(lower)) return { intent: "ACTION_UPSCALE", params: {} };
  if (/analis[ae]\s+(?:meus?\s+)?padr[oõ]es/i.test(lower) || /mem[oó]ria\s+adapt/i.test(lower)) return { intent: "ANALYZE_PATTERNS", params: {} };

  const genMatch = lower.match(/(?:cri[ae]|gere?|fa[çc]a)\s+(?:um\s+)?(?:banner|post|criativo|arte)\s+(\d+:\d+)?/i);
  if (genMatch) return { intent: "COMMAND_GENERATE", params: { format: genMatch[1] || "1:1", quantity: 1 } };

  return null;
}

// ═══ COMMAND EXECUTION ═══
async function executeCommand(
  intent: IntentResult, projectId: string, userId: string,
  supabase: any, apiKey: string, dnaContext: string, selectedAssetId?: string
): Promise<{ type: string; message: string; action?: any }> {
  switch (intent.intent) {
    case "COMMAND_SPRINT": {
      const qty = Math.min(intent.params.quantity || 10, 50);
      const profile = intent.params.profile || "standard";
      return {
        type: "command",
        message: `🚀 **Sprint de ${qty} peças configurado!**\n\nPerfil: ${profile}\nQuantidade: ${qty}\n\nVá para a tela de **Produção** e clique em **Gerar** para iniciar. O progresso aparecerá na barra.`,
        action: { type: "trigger_sprint", quantity: qty, profile },
      };
    }

    case "COMMAND_GENERATE": {
      const qty = Math.min(intent.params.quantity || 1, 5);
      const format = intent.params.format || "1:1";
      const pieceType = intent.params.pieceType || "post";
      return {
        type: "command",
        message: `🎨 **Geração configurada!**\n\nFormato: ${format}\nTipo: ${pieceType}\nQuantidade: ${qty}\n\nClique em **Gerar** na tela de Produção.`,
        action: { type: "trigger_generate", quantity: qty, format, pieceType },
      };
    }

    case "ACTION_APPROVE": {
      if (!selectedAssetId) {
        return {
          type: "command",
          message: "⚠️ Nenhum ativo selecionado. Selecione um ativo na Biblioteca primeiro e tente novamente.",
        };
      }
      try {
        await supabase.from("assets")
          .update({ status: "official", folder: "Ativos Oficiais" })
          .eq("id", selectedAssetId);

        await supabase.from("activity_log").insert({
          project_id: projectId, user_id: userId,
          action: "Aprovação via CLI", entity_type: "asset", entity_id: selectedAssetId,
        });

        // Check if we should trigger memory analysis (every 5 officials)
        const { count } = await supabase
          .from("assets")
          .select("id", { count: "exact", head: true })
          .eq("project_id", projectId)
          .eq("status", "official");

        let memoryNote = "";
        if (count && count % 5 === 0) {
          memoryNote = "\n\n🧠 _5 ativos oficiais acumulados — análise de memória será executada automaticamente._";
          // Trigger memory analysis in background
          try {
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/memory-analyze`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({ projectId, autoTriggered: true }),
            });
          } catch { /* non-blocking */ }
        }

        return {
          type: "command",
          message: `✅ **Ativo aprovado e promovido a Oficial!**\n\nMovido para a pasta "Ativos Oficiais".${memoryNote}`,
          action: { type: "asset_approved", assetId: selectedAssetId },
        };
      } catch (e: any) {
        return { type: "command", message: `❌ Erro ao aprovar: ${e.message}` };
      }
    }

    case "ACTION_UPSCALE": {
      if (!selectedAssetId) {
        return {
          type: "command",
          message: "⚠️ Nenhum ativo selecionado. Selecione um ativo para regerar com qualidade premium.",
        };
      }
      return {
        type: "command",
        message: `✨ **Regeração Premium configurada!**\n\nO ativo selecionado será regerado com perfil **Qualidade** (modelos premium). Clique em "Regerar com Qualidade" nas Ações Rápidas ou aguarde a execução.`,
        action: { type: "regenerate_quality", assetId: selectedAssetId },
      };
    }

    case "ANALYZE_PATTERNS": {
      const { data: assets } = await supabase
        .from("assets")
        .select("title, profile_used, provider_used, preset, status, asset_versions(headline, body, cta)")
        .eq("project_id", projectId)
        .in("status", ["approved", "official"])
        .order("updated_at", { ascending: false })
        .limit(10);

      if (!assets || assets.length < 3) {
        return {
          type: "command",
          message: "📊 Mínimo de 3 ativos aprovados necessário para análise. Continue gerando e aprovando!",
        };
      }

      const summary = assets.map((a: any, i: number) => {
        const v = a.asset_versions?.[0];
        return `${i + 1}. "${v?.headline || a.title}" | CTA: "${v?.cta || "-"}" | Perfil: ${a.profile_used} | Ratio: ${a.preset}`;
      }).join("\n");

      try {
        const resp = await fetch(AI_GATEWAY, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `Você é um Diretor de Arte e Copywriter. Compare o DNA atual com as últimas entregas aprovadas.
Identifique padrões fortes que contrariam ou expandem o DNA. 
Retorne análise em texto formatado com markdown.
No final, sugira 1-3 atualizações específicas para o DNA.
${dnaContext}`
              },
              { role: "user", content: `Analise estes ${assets.length} criativos aprovados:\n\n${summary}\n\nIdentifique padrões e sugira atualizações para o DNA.` },
            ],
          }),
        });

        if (!resp.ok) throw new Error("AI error");
        const data = await resp.json();
        const analysis = data.choices?.[0]?.message?.content || "Análise inconclusiva.";

        // Save as pending DNA update
        await supabase.from("pending_dna_updates").insert({
          project_id: projectId, user_id: userId,
          suggestion_text: analysis, json_patch: {}, status: "pending",
        });

        return {
          type: "command",
          message: `🧠 **Análise de Padrões**\n\n${analysis}\n\n---\n_Sugestão salva no painel de Memória Adaptativa._`,
          action: { type: "pattern_analysis" },
        };
      } catch (e: any) {
        return { type: "command", message: `❌ Erro na análise: ${e.message}` };
      }
    }

    default:
      return { type: "command", message: "Comando não reconhecido." };
  }
}
