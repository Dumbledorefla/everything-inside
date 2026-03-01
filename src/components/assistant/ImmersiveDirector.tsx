import { useState, useRef, useEffect, useCallback } from "react";
import { useAssistant } from "@/contexts/AssistantContext";
import { motion, AnimatePresence } from "framer-motion";
import BlackHoleShader from "../BlackHoleShader";
import ReactMarkdown from "react-markdown";

/**
 * ImmersiveDirector — Fullscreen "Singularity" experience.
 * Zero shadcn. Zero lucide. Pure physics-inspired UI.
 */
export default function ImmersiveDirector() {
  const {
    thread, sendMessage, activeProjectId, selectedAsset,
    agentMode, isRecording, activeThreadId, persistMessage,
  } = useAssistant();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isGlobal = agentMode === "global";
  const accentHue = isGlobal ? "270 70%" : "190 80%";

  // Toggle with Ctrl+Shift+D
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
  }, [thread]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 600);
    }
  }, [open]);

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
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 45%, hsl(240 15% 4%) 0%, hsl(0 0% 1%) 100%)",
        }}
      >
        {/* Ambient glow behind singularity */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: 600,
            height: 600,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -60%)",
            background: `radial-gradient(circle, hsl(${accentHue} 50% / 0.06) 0%, transparent 70%)`,
            filter: "blur(40px)",
          }}
        />

        {/* Close — top right, pure SVG */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          whileHover={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={() => setOpen(false)}
          className="absolute top-5 right-5 z-10 w-10 h-10 flex items-center justify-center transition-all duration-300"
          style={{
            borderRadius: 12,
            background: "hsl(0 0% 100% / 0.02)",
            border: "1px solid hsl(0 0% 100% / 0.04)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M13 1L1 13" stroke="hsl(0 0% 50%)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </motion.button>

        {/* Shortcut hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.2 }}
          transition={{ delay: 1.2 }}
          className="absolute top-5 left-5 font-mono text-[9px] tracking-[0.3em] uppercase select-none"
          style={{ color: "hsl(0 0% 35%)" }}
        >
          CTRL+SHIFT+D ← EXIT
        </motion.div>

        {/* Central Singularity */}
        <motion.div
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <BlackHoleShader
            mode={isGlobal ? "global" : "project"}
            thinking={isStreaming}
            audioLevel={isRecording ? 0.5 : 0}
            size={360}
          />

          {/* Mode indicator — holographic label */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="absolute -bottom-10 left-1/2 -translate-x-1/2 font-mono text-[9px] tracking-[0.4em] uppercase select-none"
            style={{
              color: `hsl(${accentHue} 60%)`,
              textShadow: `0 0 20px hsl(${accentHue} 40% / 0.5)`,
            }}
          >
            {isGlobal ? "◈ SINGULARIDADE GLOBAL" : "◎ SINGULARIDADE DE PROJETO"}
          </motion.div>
        </motion.div>

        {/* Holographic Chat Output — no boxes, floating monospace */}
        <div
          ref={scrollRef}
          className="mt-14 w-full max-w-2xl max-h-[28vh] overflow-y-auto px-8 space-y-4"
          style={{
            scrollbarWidth: "none",
            maskImage: "linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)",
          }}
        >
          {thread.slice(-8).map((msg, i) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.5, delay: i * 0.03 }}
              className="font-mono text-[13px] leading-[1.7]"
              style={{
                textAlign: msg.role === "user" ? "right" : "left",
                color: msg.role === "user"
                  ? "hsl(0 0% 55%)"
                  : msg.role === "system"
                    ? "hsl(40 80% 60%)"
                    : `hsl(${accentHue} 75%)`,
                textShadow: msg.role !== "user"
                  ? `0 0 16px hsl(${accentHue} 40% / 0.3)`
                  : "none",
              }}
            >
              {msg.role !== "user" && (
                <span
                  className="block font-mono text-[8px] uppercase tracking-[0.4em] mb-1 select-none"
                  style={{
                    color: msg.role === "system"
                      ? "hsl(40 60% 45%)"
                      : `hsl(${accentHue} 45%)`,
                  }}
                >
                  {msg.role === "system" ? "▲ SYS" : "◈ COS"}
                </span>
              )}
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p style={{ margin: "2px 0" }}>{children}</p>,
                  code: ({ children }) => (
                    <code
                      style={{
                        background: "hsl(0 0% 100% / 0.04)",
                        padding: "1px 5px",
                        borderRadius: 3,
                        fontSize: "12px",
                      }}
                    >
                      {children}
                    </code>
                  ),
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </motion.div>
          ))}

          {/* Streaming indicator — pulsing singularity dots */}
          {isStreaming && thread[thread.length - 1]?.role !== "assistant" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-mono text-sm flex gap-1.5"
              style={{ color: `hsl(${accentHue} 50%)` }}
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
                  style={{
                    display: "inline-block",
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: `hsl(${accentHue} 60%)`,
                    boxShadow: `0 0 8px hsl(${accentHue} 50% / 0.6)`,
                  }}
                />
              ))}
            </motion.div>
          )}
        </div>

        {/* Orbital Input — no standard input, pure singularity aesthetic */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-8 w-full max-w-xl px-8"
        >
          <div className="relative group">
            {/* Orbital glow ring */}
            <div
              className="absolute -inset-px rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity duration-700 pointer-events-none"
              style={{
                background: `conic-gradient(from 180deg, transparent, hsl(${accentHue} 40% / 0.15), transparent 60%, hsl(${accentHue} 50% / 0.1), transparent)`,
                filter: "blur(1px)",
              }}
            />

            <div
              className="relative flex items-center gap-3 px-6 py-3.5"
              style={{
                borderRadius: 28,
                background: "hsl(0 0% 4% / 0.8)",
                border: "1px solid hsl(0 0% 100% / 0.04)",
                backdropFilter: "blur(20px)",
              }}
            >
              {/* Orbit indicator */}
              <span
                className="shrink-0 w-2 h-2 rounded-full"
                style={{
                  background: isStreaming
                    ? `hsl(${accentHue} 60%)`
                    : input.trim()
                      ? `hsl(${accentHue} 50%)`
                      : "hsl(0 0% 20%)",
                  boxShadow: input.trim()
                    ? `0 0 10px hsl(${accentHue} 50% / 0.5)`
                    : "none",
                  transition: "all 0.3s ease",
                }}
              />

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="transmitir comando à singularidade..."
                disabled={isStreaming}
                className="flex-1 bg-transparent font-mono text-[13px] placeholder:select-none focus:outline-none disabled:opacity-30"
                style={{
                  color: "hsl(0 0% 75%)",
                  caretColor: `hsl(${accentHue} 60%)`,
                  letterSpacing: "0.02em",
                }}
              />

              {/* Send — pure SVG arrow */}
              <button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-all duration-300 disabled:opacity-10"
                style={{
                  background: input.trim() && !isStreaming
                    ? `hsl(${accentHue} 50% / 0.1)`
                    : "transparent",
                }}
              >
                {isStreaming ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="5.5" stroke={`hsl(${accentHue} 50%)`} strokeWidth="1.5" strokeDasharray="8 6" />
                    </svg>
                  </motion.div>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M2 7L12 7M12 7L8 3M12 7L8 11"
                      stroke={input.trim() ? `hsl(${accentHue} 60%)` : "hsl(0 0% 25%)"}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
