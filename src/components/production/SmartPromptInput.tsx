import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, X, Sparkles, Loader2, Lightbulb, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STYLE_TAGS = [
  { label: "Luz Cinematográfica", value: "cinematic lighting" },
  { label: "8K Ultra HD", value: "8k ultra high resolution" },
  { label: "Minimalista", value: "minimalist clean design" },
  { label: "Close-up", value: "close-up macro shot" },
  { label: "Profundidade", value: "shallow depth of field bokeh" },
  { label: "Neon", value: "neon glow aesthetic" },
  { label: "Editorial", value: "editorial magazine layout" },
  { label: "Flat Lay", value: "flat lay overhead composition" },
  { label: "Gradiente", value: "smooth gradient background" },
  { label: "Texturas", value: "rich textures organic materials" },
  { label: "Retro", value: "retro vintage film grain" },
  { label: "Futurista", value: "futuristic sci-fi aesthetic" },
  { label: "Luxury", value: "luxury premium high-end" },
  { label: "Orgânico", value: "organic natural earthy tones" },
  { label: "Bold Type", value: "bold typography statement" },
];

interface Idea {
  headline: string;
  body: string;
}

interface SmartPromptInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onRefine?: () => Promise<void>;
  refining?: boolean;
  projectId?: string;
  pieceType?: string;
}

export default function SmartPromptInput({
  value,
  onChange,
  placeholder = "Descreva o criativo desejado...",
  disabled,
  onRefine,
  refining,
  projectId,
  pieceType,
}: SmartPromptInputProps) {
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);

  const toggleTag = (tag: typeof STYLE_TAGS[0]) => {
    if (activeTags.includes(tag.value)) {
      setActiveTags((prev) => prev.filter((t) => t !== tag.value));
      onChange(value.replace(`, ${tag.value}`, "").replace(tag.value, "").trim());
    } else {
      setActiveTags((prev) => [...prev, tag.value]);
      onChange(value ? `${value}, ${tag.value}` : tag.value);
    }
  };

  const removeTag = (tagValue: string) => {
    setActiveTags((prev) => prev.filter((t) => t !== tagValue));
    onChange(value.replace(`, ${tagValue}`, "").replace(tagValue, "").trim());
  };

  const handleSuggestIdeas = async () => {
    if (!projectId) {
      toast.error("Projeto não identificado.");
      return;
    }
    setLoadingIdeas(true);
    try {
      const { data, error } = await supabase.functions.invoke("idea-generator", {
        body: {
          projectId,
          topic: value.trim() || "Conteúdo genérico relevante para a marca",
          pieceType: pieceType || "post",
        },
      });
      if (error) throw new Error(error.message);
      const result: Idea[] = data?.ideias || [];
      if (!result.length) {
        toast.info("A IA não retornou ideias. Tente um tópico mais específico.");
      } else {
        setIdeas(result);
        toast.success(`${result.length} ideias geradas!`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar ideias.");
    } finally {
      setLoadingIdeas(false);
    }
  };

  const applyIdea = (idea: Idea) => {
    onChange(`${idea.headline}: ${idea.body}`);
    setIdeas([]);
    toast.info("Ideia aplicada ao prompt.");
  };

  return (
    <div className="space-y-2">
      {/* Active tags */}
      <AnimatePresence>
        {activeTags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-1.5"
          >
            {activeTags.map((tag) => {
              const label = STYLE_TAGS.find((t) => t.value === tag)?.label || tag;
              return (
                <motion.button
                  key={tag}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => removeTag(tag)}
                  className="flex items-center gap-1 rounded-lg bg-primary/15 border border-primary/25 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/25 transition-all"
                >
                  {label}
                  <X className="h-2.5 w-2.5" />
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Textarea */}
      <div className="relative group">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          placeholder={placeholder}
          rows={3}
          disabled={disabled}
          className="w-full rounded-xl border border-border/25 bg-background/50 px-4 py-3 pr-12 text-xs placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
        />

        {/* Refine button */}
        {onRefine && (
          <button
            onClick={onRefine}
            disabled={refining || !value.trim() || disabled}
            title="Refinar com IA"
            className={cn(
              "absolute top-2.5 right-2.5 rounded-lg p-1.5 transition-all",
              refining
                ? "text-primary animate-pulse"
                : "text-muted-foreground/40 hover:text-primary hover:bg-primary/10"
            )}
          >
            {refining ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Suggest Ideas button */}
      {projectId && (
        <button
          onClick={handleSuggestIdeas}
          disabled={loadingIdeas || disabled}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-xl border border-cos-orange/25 bg-cos-orange/5 px-3 py-2 text-[11px] font-medium text-cos-orange hover:bg-cos-orange/15 transition-all",
            (loadingIdeas || disabled) && "opacity-60 cursor-not-allowed"
          )}
        >
          {loadingIdeas ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Lightbulb className="h-3.5 w-3.5" />
          )}
          {loadingIdeas ? "Gerando ideias..." : "Sugerir Ideias"}
        </button>
      )}

      {/* Ideas list */}
      <AnimatePresence>
        {ideas.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1.5 rounded-xl border border-border/30 bg-card/40 p-2"
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-[9px] font-mono-brand uppercase tracking-widest text-muted-foreground/60">
                Ideias sugeridas
              </span>
              <button
                onClick={() => setIdeas([])}
                className="text-[9px] text-muted-foreground/40 hover:text-muted-foreground"
              >
                Fechar
              </button>
            </div>
            {ideas.map((idea, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg border border-border/15 bg-background/40 p-2 hover:border-primary/25 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold leading-tight">{idea.headline}</p>
                  <p className="text-[10px] text-muted-foreground/80 mt-0.5 line-clamp-2">{idea.body}</p>
                </div>
                <button
                  onClick={() => applyIdea(idea)}
                  title="Usar esta ideia"
                  className="shrink-0 rounded-md p-1 text-primary hover:bg-primary/15 transition-all"
                >
                  <Send className="h-3 w-3" />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tag suggestions */}
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono-brand uppercase tracking-widest text-muted-foreground/40 flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" /> Estilos visuais
              </span>
              <button
                onClick={() => setShowSuggestions(false)}
                className="text-[9px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
              >
                Fechar
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {STYLE_TAGS.map((tag) => (
                <button
                  key={tag.value}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "rounded-lg px-2 py-1 text-[10px] font-medium transition-all border",
                    activeTags.includes(tag.value)
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "bg-card/30 border-border/15 text-muted-foreground/50 hover:text-foreground hover:border-primary/20 hover:bg-card/50"
                  )}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
