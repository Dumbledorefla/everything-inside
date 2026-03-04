import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAssistant } from "@/contexts/AssistantContext";
import { Brain, Sparkles, ChevronRight, MessageSquare, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import ChatThread from "./ChatThread";

const PAGE_WELCOME: Record<string, { greeting: string; suggestions: string[] }> = {
  production: {
    greeting: "Pronto para criar? Me diga o que você tem em mente ou clique em uma das sugestões abaixo.",
    suggestions: ["Gerar ideia para post", "Sugerir ângulo de campanha", "Criar variações de headline"],
  },
  dna: {
    greeting: "Vamos refinar a identidade do seu projeto. Posso analisar e sugerir melhorias.",
    suggestions: ["Analisar tom de voz", "Sugerir paleta de cores", "Revisar público-alvo"],
  },
  library: {
    greeting: "Aqui estão seus ativos. Posso ajudar a organizar, aprovar ou regenerar.",
    suggestions: ["Aprovar melhores peças", "Arquivar rascunhos antigos", "Analisar performance"],
  },
  planning: {
    greeting: "Vamos planejar seu conteúdo. Posso gerar um plano de 30 dias.",
    suggestions: ["Gerar plano semanal", "Sugerir horários de postagem", "Equilibrar formatos"],
  },
  references: {
    greeting: "Analise referências visuais para alimentar suas criações.",
    suggestions: ["Analisar concorrente", "Extrair paleta de referência", "Comparar estilos"],
  },
  default: {
    greeting: "Como posso ajudar? Sou seu Diretor Criativo de IA.",
    suggestions: ["Gerar ideia para post", "Analisar performance do último anúncio", "Sugerir ângulo de campanha"],
  },
};

function getPageContext(pathname: string): string {
  if (pathname.includes("/production")) return "production";
  if (pathname.includes("/dna")) return "dna";
  if (pathname.includes("/library")) return "library";
  if (pathname.includes("/planning")) return "planning";
  if (pathname.includes("/references")) return "references";
  return "default";
}

interface DirectorHeaderProps {
  onSuggestionClick: (text: string) => void;
  showWelcome: boolean;
}

function DirectorHeader({ onSuggestionClick, showWelcome }: DirectorHeaderProps) {
  const location = useLocation();
  const pageCtx = getPageContext(location.pathname);
  const welcome = PAGE_WELCOME[pageCtx] || PAGE_WELCOME.default;

  if (!showWelcome) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 pt-4 pb-2"
    >
      {/* Avatar + Title */}
      <div className="flex items-center gap-3 mb-3">
        <div className="rounded-xl bg-primary/10 border border-primary/20 p-2">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Diretor</p>
          <p className="text-[10px] text-muted-foreground">Seu Diretor Criativo de IA</p>
        </div>
      </div>

      {/* Contextual greeting */}
      <p className="text-xs text-muted-foreground leading-relaxed mb-3">
        {welcome.greeting}
      </p>

      {/* Quick action chips carousel */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {welcome.suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestionClick(s)}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all"
          >
            <Sparkles className="h-3 w-3 text-primary/60" />
            {s}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

export default function DirectorPanel() {
  const { thread, sendMessage } = useAssistant();
  const showWelcome = thread.length === 0;

  const handleSuggestionClick = (text: string) => {
    sendMessage(text, true);
  };

  return (
    <div className="flex flex-col h-full">
      <DirectorHeader onSuggestionClick={handleSuggestionClick} showWelcome={showWelcome} />
      <div className="flex-1 overflow-hidden">
        <ChatThread />
      </div>
    </div>
  );
}
