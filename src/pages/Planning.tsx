import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, Wand2 } from "lucide-react";

const daysOfWeek = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const planData: Record<number, { type: string; title: string }[]> = {
  3: [{ type: "Post", title: "Autoridade — Resultados" }],
  5: [{ type: "Story", title: "Bastidores" }],
  7: [{ type: "Ad", title: "Campanha Topo Funil" }],
  10: [{ type: "Post", title: "Prova Social" }],
  12: [{ type: "Banner", title: "Oferta Especial" }],
  14: [{ type: "Story", title: "Urgência — Últimas vagas" }],
  17: [{ type: "Post", title: "Conteúdo Educativo" }],
  20: [{ type: "Ad", title: "Remarketing" }],
  24: [{ type: "Post", title: "Transformação" }],
  28: [{ type: "Banner", title: "Countdown Final" }],
};

const typeColors: Record<string, string> = {
  Post: "bg-cos-cyan/20 text-cos-cyan",
  Story: "bg-cos-purple/20 text-cos-purple",
  Ad: "bg-cos-warning/20 text-cos-warning",
  Banner: "bg-cos-success/20 text-cos-success",
};

export default function Planning() {
  const [month] = useState("Março 2026");
  const totalDays = 31;
  const startDay = 6; // Sunday=0, March 2026 starts on Sunday

  const days = Array.from({ length: 42 }, (_, i) => {
    const day = i - startDay + 1;
    return day > 0 && day <= totalDays ? day : null;
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Planejamento</h1>
          <p className="text-xs text-muted-foreground mt-1">Calendário editorial do projeto</p>
        </div>
        <button className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors glow-cyan">
          <Wand2 className="h-3.5 w-3.5" />
          Gerar Plano 30 Dias
        </button>
      </div>

      {/* Month nav */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="rounded-md p-1 text-muted-foreground hover:bg-secondary transition-colors"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm font-semibold font-mono">{month}</span>
          <button className="rounded-md p-1 text-muted-foreground hover:bg-secondary transition-colors"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="flex gap-1">
          {["Mês", "Semana", "Lista"].map((v) => (
            <button key={v} className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:bg-secondary transition-colors first:bg-primary/10 first:text-primary">{v}</button>
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {daysOfWeek.map((d) => (
            <div key={d} className="py-2 text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => (
            <div
              key={i}
              className={`min-h-[100px] border-b border-r border-border p-2 ${day ? "hover:bg-secondary/30 cursor-pointer transition-colors" : "bg-secondary/10"}`}
            >
              {day && (
                <>
                  <span className="text-xs text-muted-foreground font-mono">{day}</span>
                  {planData[day] && (
                    <div className="mt-1 space-y-1">
                      {planData[day].map((item, j) => (
                        <motion.div
                          key={j}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`rounded px-1.5 py-0.5 text-[9px] font-medium truncate ${typeColors[item.type]}`}
                        >
                          {item.type}: {item.title}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
