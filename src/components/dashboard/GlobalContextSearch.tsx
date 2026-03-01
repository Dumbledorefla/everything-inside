import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SearchResult {
  projectId: string;
  projectName: string;
  niche: string | null;
  source: "dna" | "asset" | "chat";
  snippet: string;
}

export default function GlobalContextSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();

  const debounceRef = useCallback(() => {
    let timer: ReturnType<typeof setTimeout>;
    return (val: string) => {
      clearTimeout(timer);
      timer = setTimeout(() => setDebouncedQuery(val), 400);
    };
  }, [])();

  const handleChange = (val: string) => {
    setQuery(val);
    debounceRef(val);
  };

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["global-search", debouncedQuery],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!debouncedQuery || debouncedQuery.length < 3) return [];
      const term = `%${debouncedQuery}%`;
      const out: SearchResult[] = [];

      // Search in project DNA
      const { data: dnaResults } = await supabase
        .from("project_dna")
        .select("project_id, identity, audience, strategy, projects(name, niche)")
        .or(`identity.cs.{"${debouncedQuery}"},audience.cs.{"${debouncedQuery}"},strategy.cs.{"${debouncedQuery}"}`)
        .limit(10);

      // Search in projects name/description/product
      const { data: projectResults } = await supabase
        .from("projects")
        .select("id, name, niche, description, product")
        .or(`name.ilike.${term},description.ilike.${term},product.ilike.${term}`)
        .limit(10);

      if (projectResults) {
        projectResults.forEach((p) => {
          const match = [p.description, p.product, p.name].find(
            (s) => s && s.toLowerCase().includes(debouncedQuery.toLowerCase())
          );
          out.push({
            projectId: p.id,
            projectName: p.name,
            niche: p.niche,
            source: "dna",
            snippet: match ? match.substring(0, 120) : p.name,
          });
        });
      }

      // Search in asset titles and tags
      const { data: assetResults } = await supabase
        .from("assets")
        .select("id, title, tags, project_id, projects(name, niche)")
        .ilike("title", term)
        .limit(10);

      if (assetResults) {
        assetResults.forEach((a: any) => {
          out.push({
            projectId: a.project_id,
            projectName: a.projects?.name || "—",
            niche: a.projects?.niche,
            source: "asset",
            snippet: a.title || "Ativo sem título",
          });
        });
      }

      // Search in chat messages
      const { data: chatResults } = await supabase
        .from("chat_messages")
        .select("id, content, thread_id, chat_threads(project_id, projects(name, niche))")
        .ilike("content", term)
        .limit(8);

      if (chatResults) {
        chatResults.forEach((c: any) => {
          const proj = c.chat_threads?.projects;
          if (proj) {
            out.push({
              projectId: c.chat_threads.project_id,
              projectName: proj.name || "—",
              niche: proj.niche,
              source: "chat",
              snippet: c.content.substring(0, 120),
            });
          }
        });
      }

      // Deduplicate by projectId + source
      const seen = new Set<string>();
      return out.filter((r) => {
        const key = `${r.projectId}-${r.source}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    enabled: !!user && debouncedQuery.length >= 3,
    staleTime: 30_000,
  });

  const sourceLabel: Record<string, string> = {
    dna: "DNA",
    asset: "Ativo",
    chat: "Conversa",
  };
  const sourceColor: Record<string, string> = {
    dna: "text-primary",
    asset: "text-cos-success",
    chat: "text-cos-purple",
  };

  return (
    <div className="relative w-full max-w-xl">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Busca semântica: DNA, ativos, conversas..."
          className="w-full rounded-xl bg-surface-1 border border-border/10 py-2.5 pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/20 transition-all font-mono"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border border-primary/40 border-t-primary rounded-full animate-spin" />
        )}
      </div>

      <AnimatePresence>
        {results.length > 0 && query.length >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 right-0 mt-1.5 rounded-xl bg-surface-2 border border-border/10 shadow-lg overflow-hidden z-50 max-h-80 overflow-y-auto"
          >
            {results.map((r, i) => (
              <button
                key={`${r.projectId}-${r.source}-${i}`}
                onClick={() => {
                  navigate(`/project/${r.projectId}/home`);
                  setQuery("");
                  setDebouncedQuery("");
                }}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-card/30 transition-colors border-b border-border/5 last:border-0"
              >
                <span className={cn("text-[8px] font-mono uppercase tracking-wider mt-0.5 shrink-0 w-14", sourceColor[r.source])}>
                  {sourceLabel[r.source]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate">{r.projectName}</p>
                  <p className="text-[10px] text-muted-foreground/50 line-clamp-2 mt-0.5">{r.snippet}</p>
                </div>
                {r.niche && (
                  <span className="text-[8px] text-muted-foreground/40 font-mono shrink-0">{r.niche}</span>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
