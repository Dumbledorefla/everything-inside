import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Props {
  recent: any[];
  projectCount: number;
  drafts: number;
  official: number;
}

const statusDotColor = (s: string) =>
  s === "official" ? "bg-cos-success" :
  s === "approved" ? "bg-primary" :
  s === "draft" ? "bg-cos-warning" :
  "bg-muted-foreground";

export default function ActivityFeed({ recent, projectCount, drafts, official }: Props) {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <svg className="h-3.5 w-3.5 text-muted-foreground/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <h2 className="text-[10px] font-mono-brand text-muted-foreground/70 uppercase tracking-[0.2em]">Atividade</h2>
      </div>

      <div className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-md overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        {!recent?.length ? (
          <div className="p-10 text-center">
            <div className="w-10 h-10 mx-auto rounded-full bg-card/30 border border-border/10 flex items-center justify-center mb-3">
              <svg className="h-4 w-4 text-muted-foreground/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <p className="text-[11px] text-muted-foreground/50">Nenhuma atividade ainda</p>
          </div>
        ) : (
          <div className="divide-y divide-border/5">
            {recent.map((asset: any, i: number) => (
              <motion.button
                key={asset.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => navigate(`/project/${asset.project_id}/library`)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-card/20 transition-colors group"
              >
                <div className="relative">
                  <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusDotColor(asset.status))} />
                  {asset.status === "draft" && (
                    <div className={cn("absolute inset-0 h-1.5 w-1.5 rounded-full animate-ping opacity-30", statusDotColor(asset.status))} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate group-hover:text-primary transition-colors">
                    {asset.title || `${asset.output} — ${asset.status}`}
                  </p>
                  <p className="text-[9px] text-muted-foreground/50 truncate font-mono-brand">
                    {(asset as any).projects?.name}
                  </p>
                </div>
                <span className="text-[8px] text-muted-foreground/40 font-mono-brand shrink-0">
                  {new Date(asset.created_at).toLocaleDateString("pt-BR")}
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-md p-5 space-y-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <div className="flex items-center gap-2">
          <svg className="h-3.5 w-3.5 text-primary/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
          </svg>
          <span className="text-[10px] font-mono-brand uppercase tracking-[0.2em] text-muted-foreground/60">Resumo</span>
        </div>
        <div className="space-y-3">
          {[
            { label: "Projetos", value: projectCount, color: "bg-primary" },
            { label: "Rascunhos", value: drafts, color: "bg-cos-warning" },
            { label: "Oficiais", value: official, color: "bg-cos-success" },
          ].map((item) => {
            const total = Math.max(1, projectCount + drafts + official);
            return (
              <div key={item.label} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground/60">{item.label}</span>
                  <span className="text-[11px] font-mono-brand font-bold">{item.value}</span>
                </div>
                <div className="h-[3px] w-full rounded-full bg-card/30 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(5, (item.value / total) * 100))}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={cn("h-full rounded-full", item.color)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
