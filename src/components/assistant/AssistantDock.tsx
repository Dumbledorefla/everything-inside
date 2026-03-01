import { useAssistant } from "@/contexts/AssistantContext";
import { AnimatePresence, motion } from "framer-motion";
import ChatThread from "./ChatThread";
import ContextPanel from "./ContextPanel";
import QuickActions from "./QuickActions";
import AdaptiveMemoryObserver from "./AdaptiveMemoryObserver";
import { MessageSquare, Layers, Zap, X, FolderOpen } from "lucide-react";
import BlackHoleIcon from "../BlackHoleIcon";
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

  const { data: project } = useQuery({
    queryKey: ["project-niche-dock", pid],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("niche, name").eq("id", pid!).single();
      return data;
    },
    enabled: !!pid,
  });

  const nicheClass = project?.niche ? getNicheClass(project.niche) : "";

  if (!dockOpen) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <motion.button
          onClick={() => setDockFocused(true)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="rounded-2xl p-2.5 flex items-center gap-2 transition-transform group bg-card/40 backdrop-blur-2xl border border-border/30 shadow-xl shadow-primary/5"
        >
          <BlackHoleIcon
            mode={agentMode === "global" ? "global" : "project"}
            size={28}
            thinking={false}
          />
        </motion.button>
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
          transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
          onMouseEnter={() => setDockFocused(true)}
          onMouseLeave={() => setDockFocused(false)}
          className={cn(
            "shrink-0 h-full flex flex-col overflow-hidden transition-opacity duration-500",
            "rounded-l-3xl border-l border-border/20 bg-background/60 backdrop-blur-3xl",
            nicheClass
          )}
          style={{
            minWidth: 340,
            maxWidth: 520,
            boxShadow: dockFocused
              ? `0 0 80px -20px hsl(var(--primary) / 0.1)`
              : "none",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
            <div className="flex items-center gap-2">
              <BlackHoleIcon
                mode={agentMode === "global" ? "global" : "project"}
                size={22}
                thinking={false}
              />
              <div className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider",
                agentMode === "global"
                  ? "bg-cos-purple/10 text-cos-purple border border-cos-purple/15"
                  : "bg-primary/10 text-primary border border-primary/15"
              )}>
                {agentMode === "global" ? "Global" : project?.name?.slice(0, 12) || "Projeto"}
              </div>
            </div>

            <div className="flex gap-0.5 rounded-xl bg-card/30 p-0.5">
              {tabs.map((t) => {
                if (agentMode === "global" && t.id !== "chat") return null;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all relative",
                      activeTab === t.id
                        ? "bg-card/60 text-primary"
                        : "text-muted-foreground hover:text-foreground"
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
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-card/40 hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Memory Alert */}
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
