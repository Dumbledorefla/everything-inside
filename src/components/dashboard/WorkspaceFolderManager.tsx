import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  folders: string[];
  onSelect: (folder: string | null) => void;
  selectedFolder: string | null;
}

export default function WorkspaceFolderManager({ folders, onSelect, selectedFolder }: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setNewName("");
    setCreating(false);
    onSelect(name);
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "px-3 py-1.5 rounded-lg text-[10px] font-mono-brand uppercase tracking-wider transition-all border",
          selectedFolder === null
            ? "bg-primary/10 border-primary/20 text-primary shadow-[0_0_10px_-3px_hsl(var(--primary)/0.2)]"
            : "bg-card/20 border-border/10 text-muted-foreground/60 hover:border-border/20 hover:text-muted-foreground"
        )}
      >
        Todos
      </button>

      {folders.map((f) => (
        <button
          key={f}
          onClick={() => onSelect(f)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-[10px] font-mono-brand uppercase tracking-wider transition-all border",
            selectedFolder === f
              ? "bg-primary/10 border-primary/20 text-primary shadow-[0_0_10px_-3px_hsl(var(--primary)/0.2)]"
              : "bg-card/20 border-border/10 text-muted-foreground/60 hover:border-border/20 hover:text-muted-foreground"
          )}
        >
          ⌂ {f}
        </button>
      ))}

      <AnimatePresence>
        {creating ? (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setCreating(false);
              }}
              onBlur={() => { if (!newName.trim()) setCreating(false); }}
              placeholder="Nome da pasta..."
              className="px-3 py-1.5 rounded-lg text-[10px] font-mono-brand bg-card/30 backdrop-blur-sm border border-primary/20 text-foreground placeholder:text-muted-foreground/40 outline-none w-32 focus:shadow-[0_0_12px_-4px_hsl(var(--primary)/0.2)]"
            />
          </motion.div>
        ) : (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setCreating(true)}
            className="w-7 h-7 rounded-lg border border-dashed border-border/20 flex items-center justify-center text-muted-foreground/30 hover:text-primary hover:border-primary/20 transition-all text-xs hover:shadow-[0_0_10px_-3px_hsl(var(--primary)/0.2)]"
          >
            +
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
