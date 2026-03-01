import { useState, useCallback } from "react";
import { useAssistant } from "@/contexts/AssistantContext";
import { Send, Bot, User, Terminal, Loader2, Zap, Command } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const roleConfig = {
  user: { icon: User, label: "Você", color: "text-foreground" },
  assistant: { icon: Bot, label: "COS", color: "text-primary" },
  system: { icon: Terminal, label: "Sistema", color: "text-cos-warning" },
};

const COMMAND_HINTS = [
  { trigger: "sprint", hint: "Faça um sprint de 20 peças", icon: Zap },
  { trigger: "analise", hint: "Analise meus padrões", icon: Command },
];

export default function ChatThread() {
  const { thread, sendMessage, activeProjectId, setSpec, setActiveTab } = useAssistant();
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = { current: null as HTMLDivElement | null };

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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: apiMessages, projectId: activeProjectId }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        sendMessage(`❌ ${err.error || "Erro na comunicação com a IA"}`, false, true);
        setIsStreaming(false);
        return;
      }

      const contentType = resp.headers.get("Content-Type") || "";

      // ═══ COMMAND RESPONSE (JSON, not streaming) ═══
      if (contentType.includes("application/json")) {
        const data = await resp.json();
        if (data.type === "command") {
          sendMessage(data.message, false, true);

          // Execute action side-effects
          if (data.action?.type === "trigger_sprint") {
            const qty = data.action.quantity || 10;
            setSpec({ quantity: qty });
            toast.info(`Sprint configurado: ${qty} variações. Vá para Produção e clique Gerar.`);
          }
        } else {
          sendMessage(data.message || data.error || "Resposta inesperada", false, true);
        }
        setIsStreaming(false);
        return;
      }

      // ═══ STREAMING RESPONSE ═══
      if (!resp.body) {
        sendMessage("❌ Sem resposta da IA", false, true);
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
              sendMessage(assistantContent, false, false, true);
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

      if (assistantContent) {
        sendMessage(assistantContent, false, false, false);
      }
    } catch (e: any) {
      sendMessage(`❌ Erro: ${e.message}`, false, true);
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, thread, sendMessage, activeProjectId, setSpec, setActiveTab]);

  // Detect if input looks like a command
  const isCommand = COMMAND_HINTS.some((h) => input.toLowerCase().includes(h.trigger));

  return (
    <div className="flex flex-col h-full">
      <div ref={(el) => { scrollRef.current = el; }} className="flex-1 overflow-y-auto p-3 space-y-3">
        {thread.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
            <Bot className="h-8 w-8 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Assistente COS</p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-[240px]">
                Chat inteligente + CLI híbrido. Digite comandos ou converse sobre estratégia.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2 max-w-[280px]">
              {[
                "Faça um sprint de 10 peças",
                "Analise meus padrões",
                "Planeje 7 dias de conteúdo",
              ].map((hint) => (
                <button key={hint} onClick={() => setInput(hint)}
                  className="rounded-md border border-border bg-secondary/50 px-2.5 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
                  {hint}
                </button>
              ))}
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
              <div className={cn("rounded-lg px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap",
                msg.role === "user" ? "bg-secondary text-foreground" :
                msg.role === "system" ? "bg-cos-warning/5 text-foreground border border-cos-warning/20" :
                "bg-primary/5 text-foreground border border-primary/10")}>
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
        {isCommand && (
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <Command className="h-3 w-3 text-primary" />
            <span className="text-[10px] text-primary font-mono">Comando detectado — será executado como ação</span>
          </div>
        )}
        <div className="flex gap-2">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Comando ou conversa..."
            disabled={isStreaming}
            className={cn(
              "flex-1 rounded-md border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 transition-colors disabled:opacity-50",
              isCommand ? "border-primary/50 focus:border-primary focus:ring-primary" : "border-border focus:border-primary focus:ring-primary"
            )} />
          <button onClick={handleSend} disabled={!input.trim() || isStreaming}
            className="rounded-md bg-primary px-3 text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40">
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
