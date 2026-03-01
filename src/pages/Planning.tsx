import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Wand2, Loader2, Calendar as CalendarIcon, GripVertical } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const daysOfWeek = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const typeColors: Record<string, string> = {
  post: "bg-primary/20 text-primary",
  story: "bg-violet-500/20 text-violet-400",
  ad: "bg-amber-500/20 text-amber-400",
  banner: "bg-emerald-500/20 text-emerald-400",
  thumbnail: "bg-rose-500/20 text-rose-400",
  vsl: "bg-sky-500/20 text-sky-400",
};

export default function Planning() {
  const { projectId } = useParams();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dragAssetId, setDragAssetId] = useState<string | null>(null);

  // Fetch scheduled assets
  const { data: scheduledAssets } = useQuery({
    queryKey: ["scheduled-assets", projectId, format(currentMonth, "yyyy-MM")],
    queryFn: async () => {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      const { data } = await supabase
        .from("assets")
        .select("id, title, preset, destination, scheduled_for, platform, status, folder")
        .eq("project_id", projectId!)
        .not("scheduled_for", "is", null)
        .gte("scheduled_for", start.toISOString())
        .lte("scheduled_for", end.toISOString());
      return data || [];
    },
    enabled: !!projectId,
  });

  // Fetch official assets for drag panel
  const { data: officialAssets } = useQuery({
    queryKey: ["official-assets-planning", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("assets")
        .select("id, title, preset, destination, status, folder")
        .eq("project_id", projectId!)
        .in("status", ["approved", "official"])
        .is("scheduled_for", null)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!projectId,
  });

  // Schedule mutation
  const scheduleMut = useMutation({
    mutationFn: async ({ assetId, date, platform }: { assetId: string; date: Date; platform?: string }) => {
      const { error } = await supabase.from("assets").update({
        scheduled_for: date.toISOString(),
        platform: platform || "Instagram",
      }).eq("id", assetId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-assets"] });
      queryClient.invalidateQueries({ queryKey: ["official-assets-planning"] });
      toast.success("Ativo agendado com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Unschedule
  const unscheduleMut = useMutation({
    mutationFn: async (assetId: string) => {
      const { error } = await supabase.from("assets").update({
        scheduled_for: null,
        platform: null,
      }).eq("id", assetId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-assets"] });
      queryClient.invalidateQueries({ queryKey: ["official-assets-planning"] });
      toast.success("Agendamento removido");
    },
  });

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start (Monday = 0)
  const startDayOfWeek = (getDay(monthStart) + 6) % 7; // Convert Sunday=0 to Monday=0
  const paddedDays: (Date | null)[] = [
    ...Array(startDayOfWeek).fill(null),
    ...allDays,
  ];
  // Pad end to fill last row
  while (paddedDays.length % 7 !== 0) paddedDays.push(null);

  const getAssetsForDay = (day: Date) =>
    (scheduledAssets || []).filter((a: any) => a.scheduled_for && isSameDay(new Date(a.scheduled_for), day));

  const handleDrop = (day: Date) => {
    if (dragAssetId) {
      scheduleMut.mutate({ assetId: dragAssetId, date: day });
      setDragAssetId(null);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left: Assets panel */}
      <div className="w-56 shrink-0 border-r border-border bg-card overflow-y-auto p-3 space-y-3">
        <h3 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Ativos Aprovados</h3>
        <p className="text-[9px] text-muted-foreground">Arraste para o calendário</p>

        {(officialAssets || []).length === 0 && (
          <p className="text-[10px] text-muted-foreground/50 py-4 text-center">Nenhum ativo disponível</p>
        )}

        {(officialAssets || []).map((asset: any) => (
          <div
            key={asset.id}
            draggable
            onDragStart={() => setDragAssetId(asset.id)}
            onDragEnd={() => setDragAssetId(null)}
            className="flex items-center gap-2 rounded-md border border-border p-2 text-[10px] cursor-grab hover:border-primary/40 transition-colors active:cursor-grabbing"
          >
            <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            <div className="truncate">
              <p className="font-medium truncate">{asset.title || "Sem título"}</p>
              <p className="text-muted-foreground">{asset.preset} · {asset.destination}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Planejamento</h1>
            <p className="text-xs text-muted-foreground mt-1">Arraste ativos para os dias do calendário</p>
          </div>
          <button className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Wand2 className="h-3.5 w-3.5" />
            Gerar Plano 30 Dias
          </button>
        </div>

        {/* Month nav */}
        <div className="mb-4 flex items-center gap-3">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="rounded-md p-1 text-muted-foreground hover:bg-secondary transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold font-mono capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
          </span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="rounded-md p-1 text-muted-foreground hover:bg-secondary transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Calendar grid */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border">
            {daysOfWeek.map((d) => (
              <div key={d} className="py-2 text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {paddedDays.map((day, i) => {
              const dayAssets = day ? getAssetsForDay(day) : [];
              const isToday = day && isSameDay(day, new Date());

              return (
                <div
                  key={i}
                  onDragOver={(e) => { if (day) e.preventDefault(); }}
                  onDrop={() => day && handleDrop(day)}
                  className={`min-h-[100px] border-b border-r border-border p-2 transition-colors ${
                    day ? "hover:bg-secondary/30 cursor-pointer" : "bg-secondary/10"
                  } ${isToday ? "bg-primary/5" : ""}`}
                >
                  {day && (
                    <>
                      <span className={`text-xs font-mono ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
                        {format(day, "d")}
                      </span>
                      <div className="mt-1 space-y-1">
                        {dayAssets.map((asset: any) => (
                          <motion.div
                            key={asset.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={() => unscheduleMut.mutate(asset.id)}
                            title="Clique para remover agendamento"
                            className={`rounded px-1.5 py-0.5 text-[9px] font-medium truncate cursor-pointer hover:opacity-70 ${typeColors[asset.preset] || "bg-secondary text-muted-foreground"}`}
                          >
                            {asset.title || "Sem título"}
                          </motion.div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
