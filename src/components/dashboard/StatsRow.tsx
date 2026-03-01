import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  projectCount: number;
  drafts: number;
  official: number;
  pinned: number;
}

export default function StatsRow({ projectCount, drafts, official, pinned }: Props) {
  const stats = [
    { label: "Projetos Ativos", value: projectCount, glyph: "◎", color: "text-primary", bg: "bg-primary/8 border-primary/10", glow: "shadow-[0_0_16px_-4px_hsl(var(--primary)/0.15)]" },
    { label: "Fixados", value: pinned, glyph: "◆", color: "text-primary", bg: "bg-primary/5 border-primary/8", glow: "" },
    { label: "Em Rascunho", value: drafts, glyph: "⚡", color: "text-cos-warning", bg: "bg-cos-warning/8 border-cos-warning/10", glow: "" },
    { label: "Oficiais", value: official, glyph: "★", color: "text-cos-success", bg: "bg-cos-success/8 border-cos-success/10", glow: "" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.35 }}
          className={cn(
            "rounded-2xl border p-5 backdrop-blur-md transition-all hover:scale-[1.01]",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
            s.bg, s.glow
          )}
        >
          <div className="flex items-center gap-3.5">
            <span className={cn("text-xl", s.color)}>{s.glyph}</span>
            <div>
              <p className="text-2xl font-bold font-mono-brand tracking-tighter">{s.value}</p>
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-mono-brand">{s.label}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
