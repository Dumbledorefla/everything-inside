import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY = "https://ai-gateway.lovable.dev/v1/chat/completions";

// Section templates per page type
const PAGE_OUTLINES: Record<string, string[]> = {
  sales: ["hero", "dor", "mecanismo", "prova", "depoimentos", "oferta", "garantia", "faq", "cta"],
  landing: ["hero", "prova", "oferta", "depoimentos", "cta"],
  vsl: ["hero", "dor", "mecanismo", "prova", "oferta", "garantia", "cta"],
  presell: ["hero", "dor", "mecanismo", "prova", "oferta", "cta"],
  advertorial: ["hero", "dor", "mecanismo", "prova", "depoimentos", "oferta", "cta"],
  checkout: ["hero", "oferta", "garantia", "faq"],
  thankyou: ["hero", "bonus", "cta"],
  ecommerce: ["hero", "comparativo", "depoimentos", "oferta", "faq", "cta"],
};

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero", dor: "Dor / Problema", mecanismo: "Mecanismo Único",
  prova: "Prova Social", depoimentos: "Depoimentos", oferta: "Oferta",
  garantia: "Garantia", faq: "FAQ", cta: "CTA Final",
  comparativo: "Comparativo", bonus: "Bônus",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, projectId, pageId, pageType, pageName, sectionId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    ).auth.getUser();
    
    if (!user) throw new Error("Not authenticated");

    // ═══ ACTION: GENERATE OUTLINE ═══
    if (action === "outline") {
      const type = pageType || "sales";
      const outline = PAGE_OUTLINES[type] || PAGE_OUTLINES.sales;

      // Optionally use LLM to customize outline based on DNA
      let customOutline = outline;
      if (LOVABLE_API_KEY) {
        try {
          const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single();
          const { data: dna } = await supabase
            .from("project_dna").select("*")
            .eq("project_id", projectId)
            .order("version", { ascending: false }).limit(1).single();

          const dnaCtx = `Produto: ${project?.product || "N/A"}, Nicho: ${project?.niche || "N/A"}, Público: ${JSON.stringify(dna?.audience || {})}`;

          const resp = await fetch(AI_GATEWAY, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: "Você é um arquiteto de páginas de vendas. Retorne APENAS um array JSON de strings com os tipos de seção ideais para esta página. Tipos permitidos: hero, dor, mecanismo, prova, depoimentos, oferta, garantia, faq, cta, comparativo, bonus. Máximo 12 seções." },
                { role: "user", content: `Crie o outline ideal para uma página tipo "${type}". Contexto do projeto: ${dnaCtx}` },
              ],
              temperature: 0.3,
              max_tokens: 500,
            }),
          });
          const result = await resp.json();
          const content = result.choices?.[0]?.message?.content || "";
          const match = content.match(/\[[\s\S]*?\]/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed) && parsed.length > 0) customOutline = parsed;
          }
        } catch (e) {
          console.error("LLM outline failed, using default:", e);
        }
      }

      // Create page
      const { data: page, error: pageErr } = await supabase.from("pages").insert({
        project_id: projectId,
        user_id: user.id,
        name: pageName || `Nova ${type}`,
        page_type: type,
        status: "draft",
      }).select().single();
      if (pageErr) throw pageErr;

      // Create sections
      const sections = customOutline.map((type: string, i: number) => ({
        page_id: page.id,
        section_type: type,
        sort_order: i,
        status: "draft",
      }));
      await supabase.from("page_sections").insert(sections);

      return new Response(JSON.stringify({ page, outline: customOutline }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ ACTION: GENERATE SECTION VARIANTS ═══
    if (action === "generate-section") {
      if (!sectionId) throw new Error("sectionId required");

      const { data: section } = await supabase.from("page_sections").select("*").eq("id", sectionId).single();
      if (!section) throw new Error("Section not found");

      const { data: page } = await supabase.from("pages").select("*").eq("id", section.page_id).single();
      if (!page) throw new Error("Page not found");

      // Get DNA context
      const { data: project } = await supabase.from("projects").select("*").eq("id", page.project_id).single();
      const { data: dna } = await supabase
        .from("project_dna").select("*")
        .eq("project_id", page.project_id)
        .order("version", { ascending: false }).limit(1).single();

      const dnaCtx = `Produto: ${project?.product || "N/A"}, Nicho: ${project?.niche || "N/A"}, Público: ${JSON.stringify(dna?.audience || {})}, Estratégia: ${JSON.stringify(dna?.strategy || {})}`;
      const sectionLabel = SECTION_LABELS[section.section_type] || section.section_type;

      // Generate 3 variants via LLM
      const variants: any[] = [];
      if (LOVABLE_API_KEY) {
        const resp = await fetch(AI_GATEWAY, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `Você é um copywriter expert em páginas de vendas. Gere exatamente 3 variações para a seção "${sectionLabel}" de uma página tipo "${page.page_type}". 
                
Para cada variação retorne um JSON object com: headline (string), body (string, 2-4 frases), cta (string, texto do botão).

Retorne APENAS um array JSON com 3 objetos. Sem markdown, sem explicação.`
              },
              { role: "user", content: `Contexto DNA do projeto: ${dnaCtx}\n\nGere 3 variações para a seção "${sectionLabel}".` },
            ],
            temperature: 0.8,
            max_tokens: 2000,
          }),
        });
        const result = await resp.json();
        const content = result.choices?.[0]?.message?.content || "";
        const match = content.match(/\[[\s\S]*?\]/);
        if (match) {
          try {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed)) variants.push(...parsed);
          } catch { /* fallback below */ }
        }
      }

      // Fallback if LLM failed
      if (variants.length === 0) {
        for (let i = 0; i < 3; i++) {
          variants.push({
            headline: `${sectionLabel} - Variante ${i + 1}`,
            body: `Conteúdo da seção ${sectionLabel} para o projeto ${project?.name || ""}. Variação ${i + 1}.`,
            cta: i === 0 ? "Saiba Mais" : i === 1 ? "Compre Agora" : "Garanta Já",
          });
        }
      }

      // Save variants to DB
      const insertData = variants.map((v: any) => ({
        section_id: sectionId,
        headline: v.headline || "",
        body: v.body || "",
        cta: v.cta || "",
        style: { generated: true, section_type: section.section_type },
      }));
      await supabase.from("page_section_variants").insert(insertData);

      // Update section status
      await supabase.from("page_sections").update({ status: "review" }).eq("id", sectionId);

      return new Response(JSON.stringify({ variants: insertData, count: insertData.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ ACTION: EXPORT PAGE ═══
    if (action === "export") {
      if (!pageId) throw new Error("pageId required");

      const { data: page } = await supabase
        .from("pages")
        .select("*, page_sections(*, page_section_variants(*))")
        .eq("id", pageId)
        .single();
      if (!page) throw new Error("Page not found");

      const { data: project } = await supabase.from("projects").select("*").eq("id", page.project_id).single();
      const { data: dna } = await supabase
        .from("project_dna").select("*")
        .eq("project_id", page.project_id)
        .order("version", { ascending: false }).limit(1).single();

      const visual = (dna?.visual as any) || {};
      const sections = ((page as any).page_sections || []).sort((a: any, b: any) => a.sort_order - b.sort_order);

      const components = sections.map((s: any) => {
        const variants = s.page_section_variants || [];
        const selected = s.selected_variant_id
          ? variants.find((v: any) => v.id === s.selected_variant_id)
          : variants[0];

        return {
          type: s.section_type,
          label: SECTION_LABELS[s.section_type] || s.section_type,
          status: s.status,
          props: selected ? {
            headline: selected.headline,
            body: selected.body,
            cta: selected.cta,
            image_url: selected.image_url,
          } : null,
        };
      });

      const exportPayload = {
        page_title: page.name,
        page_type: page.page_type,
        project: { name: project?.name, niche: project?.niche, product: project?.product },
        global_styles: {
          primary_color: visual?.colors?.[0]?.hex || "#06B6D4",
          secondary_color: visual?.colors?.[1]?.hex || "#6366F1",
          font_headline: visual?.fonts?.[0]?.name || "Inter",
          font_body: visual?.fonts?.[1]?.name || "Inter",
        },
        components,
        exported_at: new Date().toISOString(),
        version: "1.0",
      };

      return new Response(JSON.stringify(exportPayload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
