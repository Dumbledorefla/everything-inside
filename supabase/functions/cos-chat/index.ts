import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
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

    const { messages, projectId } = await req.json();
    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── Full structured DNA injection ────────────────────────────
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
        if (vis?.cores) dnaContext += `\nCores: ${vis.cores}`;
      }
    }

    // ═══ MODULE 5: INTENT ROUTER (CLI Hybrid) ═══════════════════
    const lastUserMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";
    const intentResult = classifyIntent(lastUserMsg);

    if (intentResult.intent !== "conversation") {
      // Return structured command response instead of streaming
      const commandResponse = await executeCommand(
        intentResult, projectId, user.id, serviceClient, LOVABLE_API_KEY, dnaContext
      );
      return new Response(JSON.stringify(commandResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ CONVERSATION MODE (streaming) ══════════════════════════
    const systemPrompt = `Você é o Assistente COS — especialista em marketing digital e criação de conteúdo.
Você ajuda o usuário a planejar, criar e refinar criativos de marketing.
Seja direto, prático e focado em resultados. Use português brasileiro.

COMANDOS DISPONÍVEIS (informe ao usuário quando relevante):
- "Faça um sprint de X peças" → Dispara geração em massa
- "Aprove o criativo atual" → Muda status do ativo selecionado
- "Regere com qualidade" → Nova versão com perfil Premium
- "Analise meus padrões" → Analisa ativos aprovados e sugere DNA updates
- Qualquer outra mensagem → Conversa sobre estratégia e marketing
${dnaContext}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

// ═══ INTENT CLASSIFICATION ═══════════════════════════════════════
interface IntentResult {
  intent: "sprint" | "approve" | "regenerate_quality" | "analyze_patterns" | "conversation";
  params: Record<string, any>;
}

function classifyIntent(message: string): IntentResult {
  // Sprint triggers
  const sprintMatch = message.match(/(?:fa[çc]a|crie?|gere?|dispar[ae])\s+(?:um\s+)?sprint\s+(?:de\s+)?(\d+)/i)
    || message.match(/sprint\s+(?:de\s+)?(\d+)\s+pe[çc]as/i)
    || message.match(/gere?\s+(\d+)\s+(?:varia[çc][oõ]es|criativos?|pe[çc]as)/i);
  if (sprintMatch) {
    return { intent: "sprint", params: { quantity: parseInt(sprintMatch[1]) } };
  }

  // Approve triggers
  if (/aprov[ae]\s+(?:o\s+)?(?:criativo|ativo)\s*(?:atual)?/i.test(message)
    || /aprov[ae]\s+(?:isso|este|esse)/i.test(message)) {
    return { intent: "approve", params: {} };
  }

  // Regenerate with quality
  if (/reger[ae]\s+(?:com|em)\s+qualidade/i.test(message)
    || /reger[ae]\s+(?:isso|este|esse)\s+com\s+qualidade/i.test(message)
    || /nova\s+vers[aã]o\s+(?:com\s+)?qualidade/i.test(message)) {
    return { intent: "regenerate_quality", params: {} };
  }

  // Analyze patterns
  if (/analis[ae]\s+(?:meus\s+)?padr[oõ]es/i.test(message)
    || /o\s+que\s+(?:eu\s+)?(?:mais\s+)?aprov[oe]/i.test(message)
    || /padr[oõ]es?\s+de\s+aprova[çc][aã]o/i.test(message)) {
    return { intent: "analyze_patterns", params: {} };
  }

  return { intent: "conversation", params: {} };
}

// ═══ COMMAND EXECUTION ═══════════════════════════════════════════
async function executeCommand(
  intent: IntentResult,
  projectId: string,
  userId: string,
  supabase: any,
  apiKey: string,
  dnaContext: string,
): Promise<{ type: string; message: string; action?: any }> {
  switch (intent.intent) {
    case "sprint": {
      const qty = Math.min(intent.params.quantity || 10, 50);
      return {
        type: "command",
        message: `🚀 Sprint de ${qty} peças iniciado! Vá para a tela de Produção para acompanhar o progresso. Use o perfil e tipo de peça configurados no painel lateral.`,
        action: { type: "trigger_sprint", quantity: qty },
      };
    }

    case "approve": {
      return {
        type: "command",
        message: "✅ Para aprovar, selecione o ativo na Biblioteca e clique em 'Aprovar' no painel de Ações Rápidas. Ou selecione um ativo e eu executo a aprovação.",
        action: { type: "approve_selected" },
      };
    }

    case "regenerate_quality": {
      return {
        type: "command",
        message: "✨ Para regerar com perfil Qualidade, selecione o ativo e clique em 'Regerar com Qualidade' nas Ações Rápidas. Isso cria uma nova versão com instruções premium sem substituir a anterior.",
        action: { type: "regenerate_quality" },
      };
    }

    case "analyze_patterns": {
      // Fetch last 10 official assets and analyze with LLM
      const { data: assets } = await supabase
        .from("assets")
        .select("title, profile_used, provider_used, preset, asset_versions(headline, body, cta)")
        .eq("project_id", projectId)
        .in("status", ["approved", "official"])
        .order("updated_at", { ascending: false })
        .limit(10);

      if (!assets || assets.length < 3) {
        return {
          type: "command",
          message: "📊 Ainda não há ativos aprovados suficientes (mínimo 3) para detectar padrões. Continue gerando e aprovando criativos!",
        };
      }

      const assetSummary = assets.map((a: any, i: number) => {
        const v = a.asset_versions?.[0];
        return `${i + 1}. "${v?.headline || a.title}" | Perfil: ${a.profile_used} | Proporção: ${a.preset}`;
      }).join("\n");

      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `Você é um analista de padrões de marketing. Analise os criativos aprovados abaixo e identifique padrões claros (tom, comprimento, estilo, perfil preferido). Sugira atualizações para o DNA do projeto em formato conciso.\n\nDNA Atual:\n${dnaContext}`,
              },
              {
                role: "user",
                content: `Analise estes ${assets.length} criativos aprovados:\n${assetSummary}\n\nQuais padrões você identifica? Sugira atualizações para o DNA.`,
              },
            ],
          }),
        });

        if (!resp.ok) throw new Error("AI error");
        const data = await resp.json();
        const analysis = data.choices?.[0]?.message?.content || "Não foi possível analisar.";

        // Save suggestion to pending_dna_updates
        await supabase.from("pending_dna_updates").insert({
          project_id: projectId,
          user_id: userId,
          suggestion_text: analysis,
          json_patch: {},
          status: "pending",
        });

        return {
          type: "command",
          message: `🧠 **Análise de Padrões**\n\n${analysis}\n\n_A sugestão foi salva. Confira no painel de Memória Adaptativa._`,
          action: { type: "pattern_analysis" },
        };
      } catch (e: any) {
        return {
          type: "command",
          message: `❌ Erro na análise: ${e.message}`,
        };
      }
    }

    default:
      return { type: "command", message: "Comando não reconhecido." };
  }
}
