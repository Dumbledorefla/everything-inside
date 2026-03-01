import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Save, Palette, Type, History, Loader2, ImagePlus, Trash2, Link, Upload,
  Sparkles, Search, Brain, ChevronDown, ChevronUp,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface DNAForm {
  identity: { nome: string; nicho: string; produto: string; slogan: string; tom: string; personalidade: string };
  audience: { perfil: string; dor_principal: string; desejo_principal: string; objecoes: string; provas: string };
  strategy: { promessa: string; diferencial: string; mecanismo: string; cta_padrao: string; palavras_proibidas: string; pilares: string };
  visual: { estilo?: string; cores?: string; referencia?: string; colors: { name: string; hex: string }[]; fonts: { role: string; family: string; weight: string; size: string }[]; references: string[] };
}

const DEFAULT_DNA: DNAForm = {
  identity: { nome: "", nicho: "", produto: "", slogan: "", tom: "Profissional", personalidade: "" },
  audience: { perfil: "", dor_principal: "", desejo_principal: "", objecoes: "", provas: "" },
  strategy: { promessa: "", diferencial: "", mecanismo: "", cta_padrao: "", palavras_proibidas: "", pilares: "" },
  visual: {
    colors: [
      { name: "Primária", hex: "#06B6D4" },
      { name: "Secundária", hex: "#8B5CF6" },
      { name: "Acento", hex: "#F59E0B" },
      { name: "Fundo", hex: "#0F172A" },
      { name: "Texto", hex: "#E2E8F0" },
    ],
    fonts: [
      { role: "Headline", family: "JetBrains Mono", weight: "Bold", size: "32px" },
      { role: "Corpo", family: "Inter", weight: "Regular", size: "16px" },
      { role: "CTA", family: "Inter", weight: "Semibold", size: "14px" },
    ],
    references: [],
  },
};

export default function ProjectDNA() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<DNAForm>(DEFAULT_DNA);
  const [showHistory, setShowHistory] = useState(false);
  const [refUrl, setRefUrl] = useState("");
  const [uploadingRef, setUploadingRef] = useState(false);
  const [generalContext, setGeneralContext] = useState("");
  const [includeMarketResearch, setIncludeMarketResearch] = useState(true);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [marketInsights, setMarketInsights] = useState<string | null>(null);
  const [showSections, setShowSections] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").eq("id", projectId!).single();
      return data;
    },
    enabled: !!projectId,
  });

  const { data: dnaVersions } = useQuery({
    queryKey: ["dna-versions", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("project_dna").select("*").eq("project_id", projectId!).order("version", { ascending: false });
      return data || [];
    },
    enabled: !!projectId,
  });

  const latestDNA = dnaVersions?.[0];

  useEffect(() => {
    if (latestDNA) {
      setForm({
        identity: { ...DEFAULT_DNA.identity, ...(latestDNA.identity as any || {}) },
        audience: { ...DEFAULT_DNA.audience, ...(latestDNA.audience as any || {}) },
        strategy: { ...DEFAULT_DNA.strategy, ...(latestDNA.strategy as any || {}) },
        visual: { ...DEFAULT_DNA.visual, ...(latestDNA.visual as any || {}), references: (latestDNA.visual as any)?.references || [] },
      });
      // Show sections expanded if DNA already exists
      if ((latestDNA.identity as any)?.nome) setShowSections(true);
    } else if (project) {
      setForm((f) => ({ ...f, identity: { ...f.identity, nome: project.name || "", nicho: project.niche || "", produto: project.product || "" } }));
    }
  }, [latestDNA, project]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const nextVersion = (latestDNA?.version || 0) + 1;
      const { error } = await supabase.from("project_dna").insert({
        project_id: projectId!,
        version: nextVersion,
        identity: form.identity as any,
        audience: form.audience as any,
        strategy: form.strategy as any,
        visual: form.visual as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dna-versions", projectId] });
      toast.success("DNA salvo com sucesso (nova versão)");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleAIGenerate = async () => {
    if (!projectId) return;
    setAiGenerating(true);
    setMarketInsights(null);
    try {
      const { data, error } = await supabase.functions.invoke("dna-autofill", {
        body: {
          projectId,
          generalContext,
          referenceUrls: form.visual.references,
          includeMarketResearch,
        },
      });

      if (error) throw error;
      if (data?.error) {
        if (data.error.includes("Rate limit")) toast.error("Limite de requisições atingido. Tente novamente em instantes.");
        else if (data.error.includes("Credits")) toast.error("Créditos esgotados.");
        else throw new Error(data.error);
        return;
      }

      const dna = data.dna;
      if (!dna) throw new Error("No DNA returned");

      // Merge AI result with existing form, preserving references
      setForm((f) => ({
        identity: { ...f.identity, ...dna.identity },
        audience: { ...f.audience, ...dna.audience },
        strategy: { ...f.strategy, ...dna.strategy },
        visual: {
          ...f.visual,
          ...dna.visual,
          colors: dna.visual?.colors?.length ? dna.visual.colors : f.visual.colors,
          fonts: dna.visual?.fonts?.length ? dna.visual.fonts : f.visual.fonts,
          references: f.visual.references, // keep user's references
        },
      }));

      if (data.marketInsights) setMarketInsights(data.marketInsights);

      setShowSections(true);
      toast.success("DNA preenchido pela IA! Revise e salve.");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao gerar DNA");
    } finally {
      setAiGenerating(false);
    }
  };

  const update = (section: keyof DNAForm, key: string, value: any) => {
    setForm((f) => ({ ...f, [section]: { ...f[section], [key]: value } }));
  };

  const sections = [
    { key: "identity" as const, title: "Identidade", fields: [
      { k: "nome", label: "Nome do Projeto" }, { k: "nicho", label: "Nicho" }, { k: "produto", label: "Produto" },
      { k: "slogan", label: "Slogan" }, { k: "tom", label: "Tom de Voz" }, { k: "personalidade", label: "Personalidade" },
    ]},
    { key: "audience" as const, title: "Público e Voz", fields: [
      { k: "perfil", label: "Público Principal" }, { k: "dor_principal", label: "Dor Principal" }, { k: "desejo_principal", label: "Desejo Principal" },
      { k: "objecoes", label: "Objeções" }, { k: "provas", label: "Provas Sociais" },
    ]},
    { key: "strategy" as const, title: "Estratégia", fields: [
      { k: "promessa", label: "Promessa" }, { k: "diferencial", label: "Diferencial" }, { k: "mecanismo", label: "Mecanismo" },
      { k: "cta_padrao", label: "CTA Padrão" }, { k: "palavras_proibidas", label: "Palavras Proibidas" }, { k: "pilares", label: "Pilares de Conteúdo" },
    ]},
  ];

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">DNA do Projeto</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Identidade estratégica e visual — v{latestDNA?.version || 1}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-secondary transition-colors">
            <History className="h-3.5 w-3.5" />
            Histórico ({dnaVersions?.length || 0})
          </button>
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar
          </button>
        </div>
      </div>

      {showHistory && dnaVersions && dnaVersions.length > 0 && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-6 rounded-lg border border-border bg-card p-4">
          <h3 className="text-xs font-semibold mb-2">Versões</h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {dnaVersions.map((v) => (
              <button key={v.id} onClick={() => {
                setForm({
                  identity: { ...DEFAULT_DNA.identity, ...(v.identity as any || {}) },
                  audience: { ...DEFAULT_DNA.audience, ...(v.audience as any || {}) },
                  strategy: { ...DEFAULT_DNA.strategy, ...(v.strategy as any || {}) },
                  visual: { ...DEFAULT_DNA.visual, ...(v.visual as any || {}), references: (v.visual as any)?.references || [] },
                });
                setShowSections(true);
              }} className="w-full flex justify-between items-center rounded-md px-3 py-1.5 text-xs hover:bg-secondary transition-colors">
                <span>v{v.version}</span>
                <span className="text-muted-foreground">{new Date(v.created_at).toLocaleDateString("pt-BR")}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── AI Context + References Section ─────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-lg border-2 border-primary/30 bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Contexto Inteligente</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Descreva seu projeto livremente, adicione referências visuais e deixe a IA preencher todo o DNA automaticamente.
        </p>

        {/* General context textarea */}
        <div className="mb-4">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5 block">
            Contexto Geral do Projeto
          </label>
          <textarea
            value={generalContext}
            onChange={(e) => setGeneralContext(e.target.value)}
            placeholder="Ex: Meu projeto é sobre tarô terapêutico. Trabalho com leituras online para mulheres 25-45 anos que buscam autoconhecimento. Meu diferencial é a abordagem jungiana. Quero um visual místico, elegante, com tons de roxo e dourado..."
            rows={5}
            className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none"
          />
        </div>

        {/* Visual References (inline) */}
        <div className="mb-4">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5 block">
            Referências Visuais
          </label>
          <div className="flex gap-2 mb-2">
            <div className="relative flex-1">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="url"
                value={refUrl}
                onChange={(e) => setRefUrl(e.target.value)}
                placeholder="https://exemplo.com/referencia.jpg"
                className="w-full rounded-md border border-border bg-secondary/50 pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>
            <button
              onClick={() => {
                if (!refUrl.trim()) return;
                setForm((f) => ({ ...f, visual: { ...f.visual, references: [...f.visual.references, refUrl.trim()] } }));
                setRefUrl("");
                toast.success("Referência adicionada");
              }}
              disabled={!refUrl.trim()}
              className="rounded-md bg-secondary px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary/80 disabled:opacity-40 transition-colors"
            >
              <Link className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = e.target.files;
              if (!files?.length) return;
              setUploadingRef(true);
              try {
                const newUrls: string[] = [];
                for (const file of Array.from(files)) {
                  const ext = file.name.split(".").pop();
                  const path = `references/${projectId}/${crypto.randomUUID()}.${ext}`;
                  const { error } = await supabase.storage.from("assets").upload(path, file);
                  if (error) throw error;
                  const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
                  newUrls.push(urlData.publicUrl);
                }
                setForm((f) => ({ ...f, visual: { ...f.visual, references: [...f.visual.references, ...newUrls] } }));
                toast.success(`${newUrls.length} referência(s) enviada(s)`);
              } catch (err: any) {
                toast.error(err.message || "Erro no upload");
              } finally {
                setUploadingRef(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingRef}
            className="w-full rounded-lg border border-dashed border-border p-3 text-center hover:bg-secondary/50 transition-colors"
          >
            {uploadingRef ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload de imagens de referência</span>
              </div>
            )}
          </button>

          {/* Reference thumbnails */}
          {form.visual.references.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {form.visual.references.map((url, i) => (
                <div key={i} className="group relative rounded-md border border-border overflow-hidden w-16 h-16 bg-secondary shrink-0">
                  <img src={url} alt={`Ref ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setForm((f) => ({ ...f, visual: { ...f.visual, references: f.visual.references.filter((_, idx) => idx !== i) } }))}
                    className="absolute inset-0 bg-destructive/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3 text-destructive-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Market research toggle */}
        <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground cursor-pointer hover:border-foreground/20 transition-colors mb-4">
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1">Incluir pesquisa de mercado do nicho</span>
          <input
            type="checkbox"
            checked={includeMarketResearch}
            onChange={(e) => setIncludeMarketResearch(e.target.checked)}
            className="accent-primary"
          />
        </label>

        {/* Generate DNA button */}
        <button
          onClick={handleAIGenerate}
          disabled={aiGenerating || (!generalContext.trim() && form.visual.references.length === 0)}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {aiGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analisando contexto{includeMarketResearch ? " + mercado" : ""}...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Gerar DNA com IA
            </>
          )}
        </button>

        {includeMarketResearch && (
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">
            {includeMarketResearch ? "15 créditos" : "8 créditos"} · Contexto + referências{includeMarketResearch ? " + pesquisa de mercado" : ""}
          </p>
        )}
      </motion.div>

      {/* Market insights */}
      {marketInsights && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Search className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Insights de Mercado</h3>
          </div>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{marketInsights}</p>
        </motion.div>
      )}

      {/* Toggle sections visibility */}
      <button
        onClick={() => setShowSections(!showSections)}
        className="w-full flex items-center justify-center gap-2 rounded-md border border-border py-2 text-xs text-muted-foreground hover:bg-secondary transition-colors mb-6"
      >
        {showSections ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {showSections ? "Ocultar campos detalhados" : "Ver/editar campos detalhados"}
      </button>

      {showSections && (
        <>
          {sections.map((section, si) => (
            <motion.div key={section.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: si * 0.1 }} className="mb-6 rounded-lg border border-border bg-card p-5">
              <h2 className="text-sm font-semibold mb-4">{section.title}</h2>
              <div className="space-y-3">
                {section.fields.map((f) => (
                  <div key={f.k}>
                    <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">{f.label}</label>
                    <input type="text" value={(form[section.key] as any)[f.k] || ""} onChange={(e) => update(section.key, f.k, e.target.value)} className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
                  </div>
                ))}
              </div>
            </motion.div>
          ))}

          {/* Design tokens */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Design Tokens</h2>
            </div>
            <div className="mb-5">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 block">Cores</label>
              <div className="flex gap-3">
                {form.visual.colors.map((c, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <input type="color" value={c.hex} onChange={(e) => {
                      const newColors = [...form.visual.colors];
                      newColors[i] = { ...c, hex: e.target.value };
                      setForm((f) => ({ ...f, visual: { ...f.visual, colors: newColors } }));
                    }} className="h-10 w-10 rounded-lg border border-border cursor-pointer" />
                    <span className="text-[10px] text-muted-foreground">{c.name}</span>
                    <span className="text-[9px] font-mono text-muted-foreground">{c.hex}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 block">Tipografia</label>
              <div className="space-y-2">
                {form.visual.fonts.map((f, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <div className="flex items-center gap-3">
                      <Type className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">{f.role}</span>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground">{f.family} · {f.weight} · {f.size}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
