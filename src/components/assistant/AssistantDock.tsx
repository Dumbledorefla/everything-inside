import { useAssistant } from "@/contexts/AssistantContext";
import { AnimatePresence, motion } from "framer-motion";
import ChatThread from "./ChatThread";
import ContextPanel from "./ContextPanel";
import QuickActions from "./QuickActions";
import { MessageSquare, Layers, Zap, X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "chat" as const, label: "Chat", icon: MessageSquare },
  { id: "context" as const, label: "Contexto", icon: Layers },
  { id: "actions" as const, label: "Ações", icon: Zap },
];

export default function AssistantDock() {
  const { isInProject, dockOpen, dockWidth, activeTab, setActiveTab, closeDock } = useAssistant();

  if (!isInProject) return null;

  return (
    <AnimatePresence>
      {dockOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: dockWidth, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="shrink-0 h-full border-l border-border bg-card flex flex-col overflow-hidden"
          style={{ minWidth: 320, maxWidth: 520 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <div className="flex gap-0.5">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                    activeTab === t.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              ))}
            </div>
            <button onClick={closeDock} className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "chat" && <ChatThread />}
            {activeTab === "context" && <ContextPanel />}
            {activeTab === "actions" && <QuickActions />}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
