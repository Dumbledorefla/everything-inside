import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Loader2, Link, Wand2, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CloneRemodelProps {
  projectId: string;
  onSuccess: (pageId: string) => void;
  onClose: () => void;
}

type RewriteIntensity = "light" | "moderate" | "full";

const INTENSITY_OPTIONS: { id: RewriteIntensity; label: string; desc: string; icon: string }[] = [
  { id: "light", label: "Leve", desc: "Adapta o texto ao nicho, mantendo o estilo original.", icon: "✏️" },
  { id: "moderate", label: "Moderada", desc: "Reescreve os textos com o DNA do projeto, mantendo a estrutura.", icon: "🔄" },
  { id: "full", label: "Completa", desc: "Remodelação total. Usa a página apenas como inspiração estrutural.", icon: "🔥" },
];

const PROFILES = [
  { id: "economy", label: "Econômico" },
  { id: "standard", label: "Padrão" },
  { id: "quality", label: "Qualidade" },
];

export function CloneRemodel({ projectId, onSuccess, onClose }: CloneRemodelProps) {
  const queryClient = useQueryClient();
  const [sourceUrl, setSourceUrl] = useState("");
  const [pageName, setPageName] = useState("");
  const [intensity, setIntensity] = useState<RewriteIntensity>("moderate");
  const [profile, setProfile] = useState<"economy" | "standard" | "quality">("standard");

  const { mutate: clonePage, isPending } = useMutation({
    mutationFn: async () => {
      if (!sourceUrl.trim()) throw new Error("Por favor, insira a URL da página.");
      if (!sourceUrl.startsWith("http")) throw new Error("URL inválida. Inclua http:// ou https://");

      const { data, error } = await supabase.functions.invoke("page-clone", {
        body: { projectId, sourceUrl, pageName: pageName || undefined, rewriteIntensity: intensity, profile },
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || "Erro ao clonar página.");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pages", projectId] });
      toast.success(`Página clonada e remodelada! ${data.sectionsCount} seções criadas.`);
      onSuccess(data.pageId);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao clonar página."),
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Copy className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-base font-bold font-mono-brand">Clone & Remodel</h2>
          <p className="text-xs text-muted-foreground">Clona qualquer página e remodela com o DNA do projeto</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-mono-brand uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1">
          <Link className="h-3 w-3" /> URL da Página de Origem
        </label>
        <div className="flex gap-2">
          <Input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)}
            placeholder="https://exemplo.com/pagina-de-vendas" className="text-sm flex-1" />
          {sourceUrl && (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="icon" className="h-9 w-9">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground/50">
          Funciona com qualquer URL pública: landing pages, páginas de vendas, sites, etc.
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-mono-brand uppercase tracking-wider text-muted-foreground/60">
          Nome da Nova Página (opcional)
        </label>
        <Input value={pageName} onChange={e => setPageName(e.target.value)}
          placeholder="Ex: LP Tarot — Clone Remodelado" className="text-sm" />
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-mono-brand uppercase tracking-wider text-muted-foreground/60">
          Intensidade da Remodelação
        </label>
        <div className="space-y-2">
          {INTENSITY_OPTIONS.map(opt => (
            <button key={opt.id} onClick={() => setIntensity(opt.id)}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                intensity === opt.id ? "border-primary/40 bg-primary/10" : "border-border/15 bg-card/20 hover:border-primary/20"
              )}>
              <span className="text-xl">{opt.icon}</span>
              <div className="flex-1">
                <p className={cn("text-xs font-semibold", intensity === opt.id ? "text-primary" : "text-foreground")}>{opt.label}</p>
                <p className="text-[10px] text-muted-foreground/60">{opt.desc}</p>
              </div>
              {intensity === opt.id && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-mono-brand uppercase tracking-wider text-muted-foreground/60">Qualidade da Reescrita</label>
        <div className="flex gap-2">
          {PROFILES.map(p => (
            <button key={p.id} onClick={() => setProfile(p.id as any)}
              className={cn("flex-1 rounded-xl border py-2 text-xs transition-all",
                profile === p.id ? "border-primary/40 bg-primary/10 text-primary" : "border-border/15 text-muted-foreground/50 hover:border-primary/20")}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
        <Button onClick={() => clonePage()} disabled={isPending || !sourceUrl.trim()} className="flex-1 gap-2">
          {isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Clonando...</> : <><Wand2 className="h-4 w-4" />Clonar & Remodelar</>}
        </Button>
      </div>

      {isPending && (
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-center">
          <p className="text-xs text-muted-foreground/70">Isso pode levar 30-60 segundos. A IA está analisando e reescrevendo a página...</p>
        </div>
      )}
    </div>
  );
}
