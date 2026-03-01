import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, X, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface SmartPromptInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onRefine?: () => Promise<void>;
  refining?: boolean;
}

export default function SmartPromptInput({
  value,
  onChange,
  placeholder = "Descreva o criativo desejado...",
  disabled,
  onRefine,
  refining,
}: SmartPromptInputProps) {
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
