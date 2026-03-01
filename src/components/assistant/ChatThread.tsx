import { useState, useRef, useEffect } from "react";
import { useAssistant } from "@/contexts/AssistantContext";
import { Send, Bot, User, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

const roleConfig = {
  user: { icon: User, label: "Você", color: "text-foreground" },
  assistant: { icon: Bot, label: "COS", color: "text-primary" },
  system: { icon: Terminal, label: "Sistema", color: "text-cos-warning" },
};

export default function ChatThread() {
  const { thread, sendMessage } = useAssistant();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [thread.length]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {thread.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
            <Bot className="h-8 w-8 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Assistente COS</p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-[240px]">
                Descreva o que quer gerar, refinar ou pergunte sobre o projeto.
              </p>
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
              <div
                className={cn(
                  "rounded-lg px-3 py-2 text-sm max-w-[85%]",
                  msg.role === "user"
                    ? "bg-secondary text-foreground"
                    : msg.role === "system"
                    ? "bg-cos-warning/5 text-foreground border border-cos-warning/20"
                    : "bg-primary/5 text-foreground border border-primary/10"
                )}
              >
                {msg.content}
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Descreva o que quer gerar..."
            className="flex-1 rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="rounded-md bg-primary px-3 text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
