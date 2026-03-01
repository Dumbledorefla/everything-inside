import { useAssistant } from "@/contexts/AssistantContext";
import { AnimatePresence, motion } from "framer-motion";
import ChatThread from "./ChatThread";
import ContextPanel from "./ContextPanel";
import QuickActions from "./QuickActions";
import AdaptiveMemoryObserver from "./AdaptiveMemoryObserver";
import { MessageSquare, Layers, Zap, X, Globe, FolderOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNicheClass } from "@/lib/nicheAccent";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const tabs = [
  { id: "chat" as const, label: "Chat", icon: MessageSquare },
  { id: "context" as const, label: "Contexto", icon: Layers },
  { id: "actions" as const, label: "Ações", icon: Zap },
];

export default function AssistantDock() {
  const {
    isInProject, agentMode, dockOpen, dockWidth, activeTab, setActiveTab,
    closeDock, dockFocused, setDockFocused, activeProjectId,
  } = useAssistant();

  const { projectId } = useParams();
  const pid = activeProjectId || projectId;

  // Fetch project niche for accent shadow
  const { data: project } = useQuery({
    queryKey: ["project-niche-dock", pid],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("niche, name").eq("id", pid!).single();
      return data;
    },
    enabled: !!pid,
  });

  const nicheClass = project?.niche ? getNicheClass(project.niche) : "";

  // Status indicator dots (when dock is closed)
  if (!dockOpen) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <button
          onClick={() => { setDockFocused(true); }}
          className="glass rounded-2xl p-3 flex items-center gap-2 hover:scale-105 transition-transform glow-cyan"
        >
          <div className="flex gap-1.5">
            <span className="h-2 w-2 rounded-full bg-cos-success animate-pulse" />
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse delay-75" />
            <span className="h-2 w-2 rounded-full bg-cos-purple animate-pulse delay-150" />
          </div>
          <Sparkles className="h-4 w-4 text-primary" />
        </button>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      {dockOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0, x: 40 }}
          animate={{ width: dockWidth, opacity: dockFocused ? 1 : 0.4, x: 0 }}
          exit={{ width: 0, opacity: 0, x: 40 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          onMouseEnter={() => setDockFocused(true)}
          onMouseLeave={() => setDockFocused(false)}
          className={cn(
            "shrink-0 h-full flex flex-col overflow-hidden transition-opacity duration-300",
            "glass rounded-l-3xl border-l-0",
            nicheClass
          )}
          style={{
            minWidth: 340,
            maxWidth: 520,
            boxShadow: dockFocused
              ? `var(--shadow-xl), 0 0 40px -10px hsl(var(--primary) / 0.2)`
              : "var(--shadow-md)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              {/* Agent Mode Indicator */}
              <div className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider",
                agentMode === "global"
                  ? "bg-cos-purple/10 text-cos-purple border border-cos-purple/20"
                  : "bg-primary/10 text-primary border border-primary/20"
              )}>
                {agentMode === "global" ? <Globe className="h-3 w-3" /> : <FolderOpen className="h-3 w-3" />}
                {agentMode === "global" ? "Global" : project?.name?.slice(0, 12) || "Projeto"}
              </div>
            </div>

            <div className="flex gap-0.5">
              {tabs.map((t) => {
                // In global mode, only show chat tab
                if (agentMode === "global" && t.id !== "chat") return null;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all",
                      activeTab === t.id
                        ? "bg-primary/15 text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}
                  >
                    <t.icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={closeDock}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Memory Alert (project mode only) */}
          {agentMode === "project" && (
            <div className="px-4 pt-2">
              <AdaptiveMemoryObserver />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "chat" && <ChatThread />}
            {activeTab === "context" && agentMode === "project" && <ContextPanel />}
            {activeTab === "actions" && agentMode === "project" && <QuickActions />}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
