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
    { label: "Projetos Ativos", value: projectCount, glyph: "◎", color: "text-primary", bg: "bg-card border-border", iconBg: "bg-primary/10" },
    { label: "Fixados", value: pinned, glyph: "◆", color: "text-primary", bg: "bg-card border-border", iconBg: "bg-primary/10" },
    { label: "Em Rascunho", value: drafts, glyph: "⚡", color: "text-cos-warning", bg: "bg-card border-border", iconBg: "bg-cos-warning/10" },
    { label: "Oficiais", value: official, glyph: "★", color: "text-cos-success", bg: "bg-card border-border", iconBg: "bg-cos-success/10" },
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
            "rounded-2xl border p-5 transition-all hover:scale-[1.01] shadow-sm",
            s.bg
          )}
        >
          <div className="flex items-center gap-3.5">
            <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", s.iconBg)}>
              <span className={cn("text-base", s.color)}>{s.glyph}</span>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono-brand tracking-tighter">{s.value}</p>
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-mono-brand">{s.label}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
