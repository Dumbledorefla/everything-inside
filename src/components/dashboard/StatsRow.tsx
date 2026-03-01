import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatItem {
  label: string;
  value: number;
  glyph: string;
  color: string;
  bg: string;
}

interface Props {
  projectCount: number;
  drafts: number;
  official: number;
  pinned: number;
}

export default function StatsRow({ projectCount, drafts, official, pinned }: Props) {
  const stats: StatItem[] = [
    { label: "Projetos", value: projectCount, glyph: "◎", color: "text-primary", bg: "bg-primary/8 border-primary/10" },
    { label: "Fixados", value: pinned, glyph: "◆", color: "text-cos-cyan", bg: "bg-cos-cyan/8 border-cos-cyan/10" },
    { label: "Rascunhos", value: drafts, glyph: "⚡", color: "text-cos-warning", bg: "bg-cos-warning/8 border-cos-warning/10" },
    { label: "Oficiais", value: official, glyph: "★", color: "text-cos-success", bg: "bg-cos-success/8 border-cos-success/10" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, duration: 0.3 }}
          className={cn("rounded-2xl border p-4 backdrop-blur-sm transition-all hover:scale-[1.01]", s.bg)}
        >
          <div className="flex items-center gap-3">
            <span className={cn("text-lg", s.color)}>{s.glyph}</span>
            <div>
              <p className="text-xl font-bold font-mono tracking-tighter">{s.value}</p>
              <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-mono">{s.label}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
