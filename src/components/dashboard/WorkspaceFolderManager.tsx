import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  folders: string[];
  onSelect: (folder: string | null) => void;
  selectedFolder: string | null;
}

export default function WorkspaceFolderManager({ folders, onSelect, selectedFolder }: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const qc = useQueryClient();

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setNewName("");
    setCreating(false);
    // The folder is created implicitly when a project is assigned to it
    // We just need to select it
    onSelect(name);
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all border",
          selectedFolder === null
            ? "bg-primary/10 border-primary/20 text-primary"
            : "bg-transparent border-border/10 text-muted-foreground/60 hover:border-border/20 hover:text-muted-foreground"
        )}
      >
        Todos
      </button>

      {folders.map((f) => (
        <button
          key={f}
          onClick={() => onSelect(f)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all border",
            selectedFolder === f
              ? "bg-primary/10 border-primary/20 text-primary"
              : "bg-transparent border-border/10 text-muted-foreground/60 hover:border-border/20 hover:text-muted-foreground"
          )}
        >
          {f}
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
              className="px-3 py-1.5 rounded-lg text-[10px] font-mono bg-surface-1 border border-primary/20 text-foreground placeholder:text-muted-foreground/40 outline-none w-32"
            />
          </motion.div>
        ) : (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setCreating(true)}
            className="w-7 h-7 rounded-lg border border-dashed border-border/20 flex items-center justify-center text-muted-foreground/40 hover:text-primary hover:border-primary/20 transition-all text-xs"
          >
            +
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
