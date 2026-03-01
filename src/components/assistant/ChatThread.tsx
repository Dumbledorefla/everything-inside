import { useState, useCallback, useRef, useEffect } from "react";
import { useAssistant } from "@/contexts/AssistantContext";
import { Send, Bot, User, Terminal, Loader2, Zap, Command, Mic, MicOff, Globe, FolderOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";

const roleConfig = {
  user: { icon: User, label: "Você", color: "text-foreground" },
  assistant: { icon: Bot, label: "COS", color: "text-primary" },
  system: { icon: Terminal, label: "Sistema", color: "text-cos-warning" },
};

const GLOBAL_COMMANDS = [
  "Crie um novo projeto de Tarot",
  "Qual projeto está rendendo mais?",
  "Me mostre um resumo geral",
];

const PROJECT_COMMANDS = [
  "Faça um sprint de 10 peças",
  "Analise meus padrões",
  "Planeje 7 dias de conteúdo",
  "Cria um banner 1:1 pro Instagram",
];

export default function ChatThread() {
  const {
    thread, sendMessage, activeProjectId, selectedAsset, setSpec, agentMode,
    isRecording, isTranscribing, startRecording, stopRecording,
    isLoadingHistory, persistMessage, activeThreadId,
  } = useAssistant();
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thread]);

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
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        if (resp.status === 429) toast.error("Limite de requisições excedido. Aguarde alguns segundos.");
        else if (resp.status === 402) toast.error("Créditos insuficientes. Adicione créditos em Settings.");
        sendMessage(`❌ ${err.error || "Erro na comunicação com a IA"}`, false, true);
        setIsStreaming(false);
        return;
      }

      const contentType = resp.headers.get("Content-Type") || "";

      // ═══ COMMAND RESPONSE ═══
      if (contentType.includes("application/json")) {
        const data = await resp.json();
        if (data.type === "command") {
          sendMessage(data.message, false, true);

          if (data.action?.type === "trigger_sprint") {
            setSpec({ quantity: data.action.quantity || 10 });
            toast.info(`Sprint de ${data.action.quantity} configurado. Vá para Produção.`);
          } else if (data.action?.type === "trigger_generate") {
            setSpec({
              quantity: data.action.quantity || 1,
              ratio: data.action.format || "1:1",
              pieceType: data.action.pieceType || "post",
            });
            toast.info("Geração configurada. Vá para Produção.");
          } else if (data.action?.type === "asset_approved") {
            toast.success("Ativo aprovado via CLI!");
          } else if (data.action?.type === "pattern_analysis") {
            toast.success("Análise salva no painel de Memória Adaptativa");
          } else if (data.action?.type === "project_created") {
            toast.success(`Projeto "${data.action.name}" criado!`);
          }
        } else {
          sendMessage(data.message || data.error || "Resposta inesperada", false, true);
        }

        // Persist assistant response
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
        // Persist final assistant message
        persistMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          content: assistantContent,
          timestamp: Date.now(),
        });
      }
    } catch (e: any) {
      sendMessage(`❌ Erro: ${e.message}`, false, true);
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, thread, sendMessage, activeProjectId, selectedAsset, setSpec, agentMode, activeThreadId, persistMessage]);

  // Voice handling
  const handleVoiceToggle = useCallback(async () => {
    if (isRecording) {
      const text = await stopRecording();
      if (text) {
        setInput(text);
        // Auto-send voice commands
        if (/sprint|aprov|reger|analis|cri[ae]|gere|planej/i.test(text)) {
          setInput("");
          sendMessage(text, true);
          // Trigger send flow
          setTimeout(() => {
            const btn = document.getElementById("chat-send-btn");
            btn?.click();
          }, 100);
        }
      }
    } else {
      startRecording();
    }
  }, [isRecording, stopRecording, startRecording, sendMessage]);

  const isCommand = /sprint|aprov|reger|analis|banner|criativo|cri[ae]\s+um|novo\s+projeto/i.test(input);
  const quickCommands = agentMode === "global" ? GLOBAL_COMMANDS : PROJECT_COMMANDS;

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoadingHistory && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        {!isLoadingHistory && thread.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-center gap-4 py-12"
          >
            <div className={cn(
              "rounded-2xl p-4",
              agentMode === "global" ? "bg-cos-purple/10" : "bg-primary/10"
            )}>
              {agentMode === "global"
                ? <Globe className="h-8 w-8 text-cos-purple" />
                : <FolderOpen className="h-8 w-8 text-primary" />
              }
            </div>
            <div>
              <p className="text-sm font-semibold">
                {agentMode === "global" ? "Diretor Geral COS" : "Especialista de Projeto"}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                {agentMode === "global"
                  ? "Gestão de portfólio, criação de projetos e análise global."
                  : "Produção de ativos, refinamento de DNA e controle de Sprints."
                }
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2 max-w-[300px]">
              {quickCommands.map((hint) => (
                <button key={hint} onClick={() => setInput(hint)}
                  className="rounded-lg border border-border/50 bg-secondary/30 px-2.5 py-1.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all">
                  {hint}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {thread.map((msg, i) => {
            const cfg = roleConfig[msg.role];
            const Icon = cfg.icon;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={cn("flex gap-2.5", msg.role === "user" && "flex-row-reverse")}
              >
                <div className={cn(
                  "shrink-0 mt-0.5 rounded-xl p-1.5",
                  msg.role === "user" ? "bg-secondary" :
                  msg.role === "system" ? "bg-cos-warning/10" :
                  "bg-primary/10"
                )}>
                  <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
                </div>
                <div className={cn(
                  "rounded-2xl px-3.5 py-2.5 text-sm max-w-[85%] shadow-sm",
                  msg.role === "user"
                    ? "bg-secondary/80 text-foreground rounded-tr-md"
                    : msg.role === "system"
                    ? "glass text-foreground border border-cos-warning/20 rounded-tl-md"
                    : "glass text-foreground border border-primary/10 rounded-tl-md"
                )}>
                  <div className="prose prose-sm max-w-none [&>*]:my-1 [&>p]:my-0.5 [&>ul]:my-1 [&>ol]:my-1 [&>h1]:text-sm [&>h2]:text-sm [&>h3]:text-xs dark:prose-invert">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {isStreaming && thread[thread.length - 1]?.role !== "assistant" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
            <div className="shrink-0 mt-0.5 rounded-xl p-1.5 bg-primary/10">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="glass rounded-2xl rounded-tl-md px-3.5 py-2.5 border border-primary/10">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce delay-100" />
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce delay-200" />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border/50 p-3">
        {isCommand && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex items-center gap-1.5 mb-2 px-1">
            <Command className="h-3 w-3 text-primary" />
            <span className="text-[10px] text-primary font-mono">Comando detectado — será executado como ação</span>
          </motion.div>
        )}

        {isTranscribing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 mb-2 px-1">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <span className="text-[10px] text-primary font-mono">Transcrevendo áudio...</span>
          </motion.div>
        )}

        {selectedAsset && (
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <Zap className="h-3 w-3 text-cos-warning" />
            <span className="text-[10px] text-muted-foreground font-mono truncate">
              Ativo: {selectedAsset.title || selectedAsset.id.slice(0, 8)}
            </span>
          </div>
        )}

        <div className="flex gap-2 items-end">
          {/* Voice Button */}
          <button
            onClick={handleVoiceToggle}
            disabled={isStreaming || isTranscribing}
            className={cn(
              "shrink-0 rounded-xl p-2.5 transition-all",
              isRecording
                ? "bg-destructive text-destructive-foreground animate-pulse shadow-lg"
                : "bg-secondary/80 text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          {/* Text Input */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder={
                agentMode === "global"
                  ? "Briefing, novo projeto, análise..."
                  : selectedAsset
                  ? "Comando sobre o ativo selecionado..."
                  : "Comando ou conversa..."
              }
              disabled={isStreaming || isTranscribing}
              className={cn(
                "w-full rounded-xl border bg-secondary/30 px-4 py-2.5 text-sm text-foreground",
                "placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 transition-all disabled:opacity-50",
                isCommand
                  ? "border-primary/40 focus:border-primary focus:ring-primary/20"
                  : "border-border/50 focus:border-primary focus:ring-primary/20"
              )}
            />

            {/* Waveform indicator when recording */}
            {isRecording && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-0.5 items-end h-4">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-0.5 bg-destructive rounded-full"
                    animate={{ height: [4, 16, 8, 14, 6] }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      repeatType: "reverse",
                      delay: i * 0.1,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Send Button */}
          <button
            id="chat-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming || isTranscribing}
            className={cn(
              "shrink-0 rounded-xl p-2.5 transition-all",
              "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 glow-cyan"
            )}
          >
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
