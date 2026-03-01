import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAssistant } from "@/contexts/AssistantContext";
import { Brain, Check, X, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface PatternSuggestion {
  id: string;
  pattern: string;
  category: string;
  occurrences: number;
  confirmed: boolean;
}

export default function AdaptiveMemoryObserver() {
  const { projectId } = useParams();
  const pid = useParams().projectId || useAssistant().activeProjectId;
  const queryClient = useQueryClient();
  const [suggestions, setSuggestions] = useState<PatternSuggestion[]>([]);
  const { sendMessage } = useAssistant();

  // Fetch existing memory patterns
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

  // Detect patterns from approved/official assets
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

  // Analyze patterns when official assets change
  useEffect(() => {
    if (!officialAssets || officialAssets.length < 3) return;

    const patterns: Record<string, { count: number; category: string }> = {};

    // Analyze profile preference
    const profiles: Record<string, number> = {};
    const providers: Record<string, number> = {};
    const intensities: Record<string, number> = {};

    officialAssets.forEach((a) => {
      if (a.profile_used) profiles[a.profile_used] = (profiles[a.profile_used] || 0) + 1;
      if (a.provider_used) providers[a.provider_used] = (providers[a.provider_used] || 0) + 1;

      const meta = a.asset_versions?.[0]?.generation_metadata as any;
      if (meta?.piece_type) {
        const key = `piece_type:${meta.piece_type}`;
        patterns[key] = { count: (patterns[key]?.count || 0) + 1, category: "content" };
      }
    });

    // Check for dominant patterns (>= 3 occurrences)
    const newSuggestions: PatternSuggestion[] = [];
    const existingPatterns = new Set((memory || []).map((m) => m.pattern));

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

    Object.entries(providers).forEach(([provider, count]) => {
      if (count >= 3 && !existingPatterns.has(`provider_preference:${provider}`)) {
        newSuggestions.push({
          id: `provider_${provider}`,
          pattern: `provider_preference:${provider}`,
          category: "provider",
          occurrences: count,
          confirmed: false,
        });
      }
    });

    // Analyze text patterns (short headlines, aggressive tone, etc.)
    const headlineLengths = officialAssets
      .map((a) => a.asset_versions?.[0]?.headline?.length || 0)
      .filter(Boolean);
    const avgLen = headlineLengths.reduce((s, l) => s + l, 0) / (headlineLengths.length || 1);

    if (avgLen > 0 && avgLen < 40 && headlineLengths.length >= 3 && !existingPatterns.has("style:short_headlines")) {
      newSuggestions.push({
        id: "headline_short",
        pattern: "style:short_headlines",
        category: "style",
        occurrences: headlineLengths.length,
        confirmed: false,
      });
    }

    if (avgLen > 60 && headlineLengths.length >= 3 && !existingPatterns.has("style:long_headlines")) {
      newSuggestions.push({
        id: "headline_long",
        pattern: "style:long_headlines",
        category: "style",
        occurrences: headlineLengths.length,
        confirmed: false,
      });
    }

    setSuggestions(newSuggestions);
  }, [officialAssets, memory]);

  const confirmPattern = useMutation({
    mutationFn: async (suggestion: PatternSuggestion) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Not authenticated");

      await supabase.from("project_memory").insert({
        project_id: pid!,
        user_id: user.id,
        pattern: suggestion.pattern,
        category: suggestion.category,
        occurrences: suggestion.occurrences,
        confirmed: true,
      });
    },
    onSuccess: (_, suggestion) => {
      queryClient.invalidateQueries({ queryKey: ["project-memory"] });
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
      toast.success("Padrão confirmado e salvo na memória do projeto");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const dismissPattern = (id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  };

  const patternLabels: Record<string, string> = {
    "profile_preference:economy": "Preferência por perfil Economia",
    "profile_preference:standard": "Preferência por perfil Padrão",
    "profile_preference:quality": "Preferência por perfil Qualidade",
    "style:short_headlines": "Headlines curtas (< 40 caracteres)",
    "style:long_headlines": "Headlines longas (> 60 caracteres)",
  };

  if (suggestions.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="rounded-lg border border-cos-purple/30 bg-cos-purple/5 p-3 space-y-2"
      >
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-cos-purple" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-cos-purple">Memória Adaptativa</span>
        </div>
        {suggestions.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
            <div>
              <p className="text-xs font-medium">{patternLabels[s.pattern] || s.pattern}</p>
              <p className="text-[10px] text-muted-foreground">{s.occurrences} ativos oficiais com este padrão</p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => confirmPattern.mutate(s)}
                disabled={confirmPattern.isPending}
                className="rounded-md p-1.5 text-cos-success hover:bg-cos-success/10 transition-colors"
                title="Confirmar padrão"
              >
                {confirmPattern.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => dismissPattern(s.id)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary transition-colors"
                title="Ignorar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
