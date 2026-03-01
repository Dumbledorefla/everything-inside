import { useState, useRef, useEffect, useCallback } from "react";
import { useAssistant } from "@/contexts/AssistantContext";
import { Send, Bot, User, Terminal, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const roleConfig = {
  user: { icon: User, label: "Você", color: "text-foreground" },
  assistant: { icon: Bot, label: "COS", color: "text-primary" },
  system: { icon: Terminal, label: "Sistema", color: "text-cos-warning" },
};

export default function ChatThread() {
  const { thread, sendMessage, activeProjectId } = useAssistant();
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [thread.length, thread[thread.length - 1]?.content]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    setIsStreaming(true);

    // Add user message immediately
    sendMessage(trimmed, true); // true = user only, don't mock

    // Build messages for API
    const apiMessages = [...thread, { role: "user" as const, content: trimmed }]
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cos-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: apiMessages, projectId: activeProjectId }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        sendMessage(`❌ ${err.error || "Erro na comunicação com a IA"}`, false, true);
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

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              sendMessage(assistantContent, false, false, true); // streaming update
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              sendMessage(assistantContent, false, false, true);
            }
          } catch {}
        }
      }

      // Finalize
      if (assistantContent) {
        sendMessage(assistantContent, false, false, false); // final
      }
    } catch (e: any) {
      sendMessage(`❌ Erro: ${e.message}`, false, true);
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, thread, sendMessage, activeProjectId]);

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {thread.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
            <Bot className="h-8 w-8 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Assistente COS</p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-[240px]">Descreva o que quer gerar, refinar ou pergunte sobre o projeto.</p>
            </div>
          </div>
        )}
        {thread.map((msg) => {
          const cfg = roleConfig[msg.role];
          const Icon = cfg.icon;
          return (
            <div key={msg.id} className={cn("flex gap-2", msg.role === "user" && "flex-row-reverse")}>
              <div className={cn("shrink-0 mt-0.5 rounded-md p-1", msg.role === "user" ? "bg-secondary" : "bg-primary/10")}>
                <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
              </div>
              <div className={cn("rounded-lg px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap", msg.role === "user" ? "bg-secondary text-foreground" : msg.role === "system" ? "bg-cos-warning/5 text-foreground border border-cos-warning/20" : "bg-primary/5 text-foreground border border-primary/10")}>
                {msg.content}
              </div>
            </div>
          );
        })}
        {isStreaming && thread[thread.length - 1]?.role !== "assistant" && (
          <div className="flex gap-2">
            <div className="shrink-0 mt-0.5 rounded-md p-1 bg-primary/10"><Bot className="h-3.5 w-3.5 text-primary" /></div>
            <div className="rounded-lg px-3 py-2 text-sm bg-primary/5 border border-primary/10"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
          </div>
        )}
      </div>
      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()} placeholder="Descreva o que quer gerar..." disabled={isStreaming} className="flex-1 rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors disabled:opacity-50" />
          <button onClick={handleSend} disabled={!input.trim() || isStreaming} className="rounded-md bg-primary px-3 text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40">
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
