import { useState, useRef, useEffect, useCallback } from "react";
import { useAssistant } from "@/contexts/AssistantContext";
import { motion, AnimatePresence } from "framer-motion";
import BlackHoleShader from "../BlackHoleShader";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * ImmersiveDirector — Fullscreen "Singularity" experience.
 * The black hole dominates the center. Chat output is holographic
 * monospace text orbiting the singularity. UI collapses to edges.
 */
export default function ImmersiveDirector() {
  const {
    thread, sendMessage, activeProjectId, selectedAsset,
    agentMode, isRecording, activeThreadId, persistMessage,
  } = useAssistant();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [localMessages, setLocalMessages] = useState<{ role: string; content: string; id: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Toggle with keyboard shortcut (Ctrl+Shift+D)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setOpen((p) => !p);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [localMessages, thread]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    setIsStreaming(true);

    sendMessage(trimmed, true);

    const apiMessages = [...thread, { role: "user" as const, content: trimmed }]
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cos-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: apiMessages,
          projectId: activeProjectId,
          selectedAssetId: selectedAsset?.id || null,
          agentMode,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro" }));
        sendMessage(`❌ ${err.error || "Erro na comunicação"}`, false, true);
        setIsStreaming(false);
        return;
      }

      const contentType = resp.headers.get("Content-Type") || "";

      if (contentType.includes("application/json")) {
        const data = await resp.json();
        sendMessage(data.message || data.error || "...", false, true);
        if (activeThreadId && data.message) {
          persistMessage({
            id: crypto.randomUUID(),
            role: "system",
            content: data.message,
            timestamp: Date.now(),
            actions: data.action,
          });
        }
        setIsStreaming(false);
        return;
      }

      if (!resp.body) {
        sendMessage("❌ Sem resposta", false, true);
        setIsStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, idx);
          textBuffer = textBuffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) {
              assistantContent += c;
              sendMessage(assistantContent, false, false, true);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (assistantContent) {
        sendMessage(assistantContent, false, false, false);
        persistMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          content: assistantContent,
          timestamp: Date.now(),
        });
      }
    } catch (e: any) {
      sendMessage(`❌ ${e.message}`, false, true);
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, thread, sendMessage, activeProjectId, selectedAsset, agentMode, activeThreadId, persistMessage]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
        style={{ background: "radial-gradient(ellipse at center, #050510 0%, #000000 100%)" }}
      >
        {/* Close */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={() => setOpen(false)}
          className="absolute top-6 right-6 z-10 rounded-xl p-2 text-muted-foreground/60 hover:text-foreground transition-colors bg-card/10 backdrop-blur-sm border border-border/10"
        >
          <X className="h-5 w-5" />
        </motion.button>

        {/* Shortcut hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 1 }}
          className="absolute top-6 left-6 text-[10px] font-mono text-muted-foreground/40"
        >
          Ctrl+Shift+D para fechar
        </motion.div>

        {/* Central Black Hole */}
        <motion.div
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <BlackHoleShader
            mode={agentMode === "global" ? "global" : "project"}
            thinking={isStreaming}
            audioLevel={isRecording ? 0.5 : 0}
            size={320}
          />

          {/* Holographic label */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className={cn(
              "absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-mono tracking-[0.3em] uppercase",
              agentMode === "global" ? "text-cos-purple/60" : "text-primary/60"
            )}
          >
            {agentMode === "global" ? "DIRETOR GLOBAL" : "DIRETOR DE PROJETO"}
          </motion.div>
        </motion.div>

        {/* Holographic Chat Output */}
        <div
          ref={scrollRef}
          className="mt-12 w-full max-w-2xl max-h-[30vh] overflow-y-auto px-8 space-y-3 scrollbar-none"
        >
          {thread.slice(-8).map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.4 }}
              className={cn(
                "font-mono text-sm leading-relaxed",
                msg.role === "user"
                  ? "text-foreground/70 text-right"
                  : msg.role === "system"
                  ? "text-cos-warning/80"
                  : agentMode === "global"
                  ? "text-cos-purple/90"
                  : "text-primary/90"
              )}
            >
              {msg.role !== "user" && (
                <span className="text-[9px] uppercase tracking-widest opacity-40 block mb-0.5">
                  {msg.role === "system" ? "SYS" : "COS"}
                </span>
              )}
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="my-0.5">{children}</p>,
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </motion.div>
          ))}

          {isStreaming && thread[thread.length - 1]?.role !== "assistant" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                "font-mono text-sm",
                agentMode === "global" ? "text-cos-purple/60" : "text-primary/60"
              )}
            >
              <span className="inline-flex gap-1">
                <span className="animate-bounce">▪</span>
                <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>▪</span>
                <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>▪</span>
              </span>
            </motion.div>
          )}
        </div>

        {/* Orbital Input */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-6 w-full max-w-xl px-8"
        >
          <div className="relative group">
            <div className={cn(
              "absolute -inset-px rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500",
              agentMode === "global"
                ? "bg-gradient-to-r from-cos-purple/20 via-cos-purple/5 to-cos-purple/20"
                : "bg-gradient-to-r from-primary/20 via-primary/5 to-primary/20"
            )} />
            <div className="relative flex items-center gap-3 rounded-2xl border border-border/15 bg-card/10 backdrop-blur-xl px-5 py-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Comando ao Diretor..."
                disabled={isStreaming}
                className="flex-1 bg-transparent text-sm font-mono text-foreground/90 placeholder:text-muted-foreground/30 focus:outline-none disabled:opacity-40"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                className={cn(
                  "shrink-0 rounded-xl p-2 transition-all",
                  agentMode === "global"
                    ? "text-cos-purple hover:bg-cos-purple/10"
                    : "text-primary hover:bg-primary/10",
                  "disabled:opacity-20"
                )}
              >
                {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
