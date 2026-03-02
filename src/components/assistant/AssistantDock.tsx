import { useAssistant } from "@/contexts/AssistantContext";
import { AnimatePresence, motion } from "framer-motion";
import ChatThread from "./ChatThread";
import ContextPanel from "./ContextPanel";
import QuickActions from "./QuickActions";
import AdaptiveMemoryObserver from "./AdaptiveMemoryObserver";
import BlackHoleShader from "../BlackHoleShader";
import { getNicheClass } from "@/lib/nicheAccent";
import { useCurrentTheme } from "../ThemeToggle";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const tabs = [
  { id: "chat" as const, label: "COMM", symbol: "◈" },
  { id: "context" as const, label: "CTX", symbol: "◎" },
  { id: "actions" as const, label: "ACT", symbol: "⚡" },
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
  const isGlobal = agentMode === "global";
  const accentVar = isGlobal ? "var(--cos-purple, 180 60% 60%)" : "var(--primary)";
  const currentTheme = useCurrentTheme();
  const isRainy = currentTheme === "rainy";

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
          className="rounded-full p-1 backdrop-blur-xl"
          style={{
            background: isRainy
              ? "radial-gradient(circle, hsl(0 0% 100% / 0.85) 40%, transparent 100%)"
              : "radial-gradient(circle, hsl(0 0% 5% / 0.9) 40%, transparent 100%)",
            boxShadow: isRainy
              ? `0 0 30px -10px hsl(199 89% 58% / 0.3)`
              : `0 0 40px -10px hsl(${isGlobal ? "25 90% 50%" : "30 95% 50%"} / 0.5)`,
          }}
        >
          <BlackHoleShader
            mode={isGlobal ? "global" : "project"}
            size={44}
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
          className={`shrink-0 h-full flex flex-col overflow-hidden transition-opacity duration-500 ${nicheClass}`}
          style={{
            minWidth: 340,
            maxWidth: 520,
            background: isRainy
              ? "linear-gradient(180deg, hsl(0 0% 100% / 0.72) 0%, hsl(0 0% 100% / 0.65) 100%)"
              : "linear-gradient(180deg, hsl(0 0% 3% / 0.95) 0%, hsl(0 0% 2% / 0.98) 100%)",
            backdropFilter: isRainy ? "blur(20px) saturate(1.8)" : "blur(40px) saturate(1.2)",
            borderLeft: isRainy
              ? "1px solid hsl(0 0% 100% / 0.3)"
              : "1px solid hsl(0 0% 100% / 0.04)",
            boxShadow: dockFocused
              ? isRainy
                ? `0 0 40px -10px hsl(199 89% 58% / 0.1)`
                : `inset 1px 0 0 hsl(${isGlobal ? "270 70% 50%" : "190 80% 50%"} / 0.08), -20px 0 80px -20px hsl(${isGlobal ? "270 70% 50%" : "190 80% 50%"} / 0.06)`
              : isRainy ? "0 8px 32px 0 rgba(31, 38, 135, 0.07)" : "none",
          }}
        >
          {/* Header — pure custom */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: isRainy ? "1px solid hsl(215 25% 70% / 0.2)" : "1px solid hsl(0 0% 100% / 0.04)" }}
          >
            <div className="flex items-center gap-2.5">
              <BlackHoleShader
                mode={isGlobal ? "global" : "project"}
                size={28}
                thinking={false}
              />
              <span
                className="font-mono text-[10px] uppercase tracking-[0.25em]"
                style={{
                  color: isRainy
                    ? `hsl(${isGlobal ? "270 70% 40%" : "199 89% 40%"})`
                    : `hsl(${isGlobal ? "270 70% 70%" : "190 80% 70%"})`,
                  textShadow: isRainy
                    ? "none"
                    : `0 0 12px hsl(${isGlobal ? "270 70% 50%" : "190 80% 50%"} / 0.4)`,
                }}
              >
                {isGlobal ? "GLOBAL" : (project?.name?.slice(0, 12).toUpperCase() || "PROJETO")}
              </span>
            </div>

            {/* Tabs — custom glyphs */}
            <div className="flex gap-1">
              {tabs.map((t) => {
                if (isGlobal && t.id !== "chat") return null;
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className="relative px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all duration-300"
                    style={{
                      color: isActive
                        ? isRainy
                          ? `hsl(${isGlobal ? "270 70% 40%" : "199 89% 35%"})`
                          : `hsl(${isGlobal ? "270 70% 80%" : "190 80% 80%"})`
                        : isRainy ? "hsl(215 16% 47%)" : "hsl(0 0% 40%)",
                      background: isActive
                        ? isRainy ? "hsl(199 89% 58% / 0.08)" : "hsl(0 0% 100% / 0.03)"
                        : "transparent",
                      borderRadius: 6,
                      textShadow: isActive && !isRainy
                        ? `0 0 8px hsl(${isGlobal ? "270 70% 50%" : "190 80% 50%"} / 0.5)`
                        : "none",
                    }}
                  >
                    <span className="mr-1">{t.symbol}</span>
                    {t.label}
                    {isActive && (
                      <span
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-px"
                        style={{
                          background: isRainy
                            ? `linear-gradient(90deg, transparent, hsl(199 89% 48%), transparent)`
                            : `linear-gradient(90deg, transparent, hsl(${isGlobal ? "270 70% 60%" : "190 80% 60%"}), transparent)`,
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Close — custom X glyph */}
            <button
              onClick={closeDock}
              className="w-7 h-7 flex items-center justify-center transition-all duration-200"
              style={{
                color: isRainy ? "hsl(215 16% 57%)" : "hsl(0 0% 35%)",
                borderRadius: 6,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = isRainy ? "hsl(215 25% 27%)" : "hsl(0 0% 70%)";
                e.currentTarget.style.background = isRainy ? "hsl(215 25% 17% / 0.06)" : "hsl(0 0% 100% / 0.04)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = isRainy ? "hsl(215 16% 57%)" : "hsl(0 0% 35%)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
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
