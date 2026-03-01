import { cn } from "@/lib/utils";

export interface FilterState {
  niche: string | null;
  stale: boolean;
  minAssets: number | null;
  status: string | null;
}

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  availableNiches: string[];
}

const statusOptions = [
  { value: null, label: "Todos" },
  { value: "active", label: "Ativo" },
  { value: "sprint", label: "Sprint" },
  { value: "review", label: "Revisão" },
  { value: "done", label: "Concluído" },
];

export default function DashboardFilters({ filters, onChange, availableNiches }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-3 py-2">
      {/* Niche filter */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-muted-foreground/40 font-mono-brand uppercase tracking-wider">Nicho</span>
        <select
          value={filters.niche || ""}
          onChange={(e) => set({ niche: e.target.value || null })}
          className="bg-card/30 backdrop-blur-sm border border-border/10 rounded-lg px-2.5 py-1.5 text-[10px] font-mono-brand text-foreground/80 outline-none focus:border-primary/20 transition-colors appearance-none cursor-pointer"
        >
          <option value="">Todos</option>
          {availableNiches.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      <div className="w-px h-4 bg-border/10" />

      {/* Stale filter */}
      <button
        onClick={() => set({ stale: !filters.stale })}
        className={cn(
          "px-3 py-1.5 rounded-lg text-[10px] font-mono-brand uppercase tracking-wider border transition-all",
          filters.stale
            ? "bg-cos-warning/10 border-cos-warning/20 text-cos-warning shadow-[0_0_12px_-4px_hsl(var(--cos-warning)/0.3)]"
            : "bg-card/20 border-border/10 text-muted-foreground/50 hover:border-border/20 hover:text-muted-foreground/70"
        )}
      >
        ◷ Inativos 15d+
      </button>

      {/* Asset volume filter */}
      <button
        onClick={() => set({ minAssets: filters.minAssets ? null : 50 })}
        className={cn(
          "px-3 py-1.5 rounded-lg text-[10px] font-mono-brand uppercase tracking-wider border transition-all",
          filters.minAssets
            ? "bg-cos-success/10 border-cos-success/20 text-cos-success shadow-[0_0_12px_-4px_hsl(var(--cos-success)/0.3)]"
            : "bg-card/20 border-border/10 text-muted-foreground/50 hover:border-border/20 hover:text-muted-foreground/70"
        )}
      >
        ◆ 50+ Ativos
      </button>

      <div className="w-px h-4 bg-border/10" />

      {/* Status filter */}
      <div className="flex items-center gap-1">
        {statusOptions.map((s) => (
          <button
            key={s.label}
            onClick={() => set({ status: s.value })}
            className={cn(
              "px-2.5 py-1.5 rounded-lg text-[9px] font-mono-brand uppercase tracking-wider border transition-all",
              filters.status === s.value
                ? "bg-primary/10 border-primary/20 text-primary"
                : "bg-transparent border-transparent text-muted-foreground/40 hover:text-muted-foreground/60"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
