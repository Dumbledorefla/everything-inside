import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAssistant } from "@/contexts/AssistantContext";
import { Brain, Check, X, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface PendingUpdate {
  id: string;
  suggestion_text: string;
  json_patch: any;
  status: string;
  created_at: string;
}

interface PatternSuggestion {
  id: string;
  pattern: string;
  category: string;
  occurrences: number;
  confirmed: boolean;
}

export default function AdaptiveMemoryObserver() {
  const { activeProjectId: pid, sendMessage } = useAssistant();
  const queryClient = useQueryClient();
  const [analyzing, setAnalyzing] = useState(false);

  // Fetch pending DNA updates (LLM-generated suggestions)
  const { data: pendingUpdates } = useQuery({
    queryKey: ["pending-dna-updates", pid],
    queryFn: async () => {
      const { data } = await supabase
        .from("pending_dna_updates")
        .select("*")
        .eq("project_id", pid!)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5);
      return (data || []) as PendingUpdate[];
    },
    enabled: !!pid,
    refetchInterval: 30_000,
  });

  // Fetch existing memory patterns (local detection)
  const { data: memory } = useQuery({
    queryKey: ["project-memory", pid],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_memory")
        .select("*")
        .eq("project_id", pid!)
        .order("occurrences", { ascending: false });
      return (data || []) as PatternSuggestion[];
    },
    enabled: !!pid,
  });

  // Local pattern detection from approved assets
  const { data: officialAssets } = useQuery({
    queryKey: ["official-assets-patterns", pid],
    queryFn: async () => {
      const { data } = await supabase
        .from("assets")
        .select("*, asset_versions(headline, body, cta, generation_metadata)")
        .eq("project_id", pid!)
        .in("status", ["approved", "official"])
        .order("updated_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!pid,
  });

  const [localSuggestions, setLocalSuggestions] = useState<PatternSuggestion[]>([]);

  useEffect(() => {
    if (!officialAssets || officialAssets.length < 3) return;

    const existingPatterns = new Set((memory || []).map((m) => m.pattern));
    const newSuggestions: PatternSuggestion[] = [];

    const profiles: Record<string, number> = {};
    officialAssets.forEach((a) => {
      if (a.profile_used) profiles[a.profile_used] = (profiles[a.profile_used] || 0) + 1;
    });

    Object.entries(profiles).forEach(([profile, count]) => {
      if (count >= 3 && !existingPatterns.has(`profile_preference:${profile}`)) {
        newSuggestions.push({
          id: `profile_${profile}`,
          pattern: `profile_preference:${profile}`,
          category: "quality",
          occurrences: count,
          confirmed: false,
        });
      }
    });

    const headlineLengths = officialAssets
      .map((a) => a.asset_versions?.[0]?.headline?.length || 0).filter(Boolean);
    const avgLen = headlineLengths.reduce((s, l) => s + l, 0) / (headlineLengths.length || 1);

    if (avgLen > 0 && avgLen < 40 && headlineLengths.length >= 3 && !existingPatterns.has("style:short_headlines")) {
      newSuggestions.push({
        id: "headline_short", pattern: "style:short_headlines", category: "style",
        occurrences: headlineLengths.length, confirmed: false,
      });
    }

    setLocalSuggestions(newSuggestions);
  }, [officialAssets, memory]);

  // Trigger LLM analysis
  const triggerAnalysis = async () => {
    if (!pid) return;
    setAnalyzing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/memory-analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId: pid }),
      });

      if (!resp.ok) throw new Error("Erro na análise");
      const data = await resp.json();
      queryClient.invalidateQueries({ queryKey: ["pending-dna-updates"] });
      toast.success(`Análise concluída: ${data.patterns?.length || 0} padrões detectados`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // Apply DNA update
  const applyDnaUpdate = useMutation({
    mutationFn: async (update: PendingUpdate) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Not authenticated");

      // Get current DNA
      const { data: currentDna } = await supabase
        .from("project_dna")
        .select("*")
        .eq("project_id", pid!)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      // Create new DNA version with patch
      const newVersion = (currentDna?.version || 0) + 1;
      const mergedIdentity = {
        ...(currentDna?.identity as any || {}),
        ...(update.json_patch?.identity || {}),
      };
      const mergedStrategy = {
        ...(currentDna?.strategy as any || {}),
        ...(update.json_patch?.strategy || {}),
      };
      const mergedVisual = {
        ...(currentDna?.visual as any || {}),
        ...(update.json_patch?.visual || {}),
      };

      await supabase.from("project_dna").insert({
        project_id: pid!,
        version: newVersion,
        identity: mergedIdentity,
        audience: currentDna?.audience || {},
        strategy: mergedStrategy,
        visual: mergedVisual,
        funnel: currentDna?.funnel || {},
      });

      // Mark update as applied
      await supabase
        .from("pending_dna_updates")
        .update({ status: "applied" })
        .eq("id", update.id);

      // Log activity
      await supabase.from("activity_log").insert({
        project_id: pid!,
        user_id: user.id,
        action: `DNA atualizado para v${newVersion} via Memória Adaptativa`,
        entity_type: "dna",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-dna-updates"] });
      queryClient.invalidateQueries({ queryKey: ["project-dna"] });
      toast.success("DNA atualizado com nova versão!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const dismissUpdate = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("pending_dna_updates").update({ status: "dismissed" }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pending-dna-updates"] }),
  });

  const confirmLocalPattern = useMutation({
    mutationFn: async (s: PatternSuggestion) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Not authenticated");
      await supabase.from("project_memory").insert({
        project_id: pid!, user_id: user.id,
        pattern: s.pattern, category: s.category,
        occurrences: s.occurrences, confirmed: true,
      });
    },
    onSuccess: (_, s) => {
      queryClient.invalidateQueries({ queryKey: ["project-memory"] });
      setLocalSuggestions((prev) => prev.filter((x) => x.id !== s.id));
      toast.success("Padrão salvo na memória do projeto");
    },
  });

  const hasSuggestions = (pendingUpdates?.length || 0) > 0 || localSuggestions.length > 0;

  return (
    <div className="space-y-3">
      {/* Analysis trigger */}
      <button onClick={triggerAnalysis} disabled={analyzing}
        className="w-full flex items-center justify-center gap-2 rounded-md border border-cos-purple/30 bg-cos-purple/5 px-3 py-2 text-xs text-cos-purple hover:bg-cos-purple/10 transition-colors disabled:opacity-50">
        {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
        {analyzing ? "Analisando padrões..." : "Analisar Padrões com IA"}
      </button>

      {/* LLM-generated suggestions */}
      <AnimatePresence>
        {pendingUpdates?.map((u) => (
          <motion.div key={u.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="rounded-lg border border-cos-purple/30 bg-cos-purple/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-cos-purple" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-cos-purple">Sugestão de IA</span>
            </div>
            <p className="text-xs text-foreground leading-relaxed">{u.suggestion_text}</p>
            {Object.keys(u.json_patch || {}).length > 0 && (
              <pre className="text-[10px] text-muted-foreground bg-secondary/50 rounded-md p-2 overflow-x-auto">
                {JSON.stringify(u.json_patch, null, 2)}
              </pre>
            )}
            <div className="flex gap-2">
              <button onClick={() => applyDnaUpdate.mutate(u)} disabled={applyDnaUpdate.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-cos-purple/20 px-3 py-1.5 text-[10px] font-medium text-cos-purple hover:bg-cos-purple/30 transition-colors">
                {applyDnaUpdate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Aplicar ao DNA
              </button>
              <button onClick={() => dismissUpdate.mutate(u.id)}
                className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-secondary transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Local pattern suggestions */}
      {localSuggestions.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Padrões Locais</span>
          </div>
          {localSuggestions.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
              <div>
                <p className="text-xs font-medium">{s.pattern.replace("_", " ")}</p>
                <p className="text-[10px] text-muted-foreground">{s.occurrences} ocorrências</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => confirmLocalPattern.mutate(s)}
                  className="rounded-md p-1.5 text-cos-success hover:bg-cos-success/10">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setLocalSuggestions((p) => p.filter((x) => x.id !== s.id))}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!hasSuggestions && !analyzing && (
        <p className="text-[10px] text-muted-foreground/60 text-center italic py-2">
          Nenhum padrão detectado ainda. Aprove mais ativos ou clique em "Analisar".
        </p>
      )}
    </div>
  );
}
