import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Star, MoreHorizontal, Archive, Copy, Pin, Zap, FolderOpen } from "lucide-react";
import CreateProjectWizard from "@/components/CreateProjectWizard";

const mockProjects = [
  { id: "1", name: "Lançamento Expert Pro", niche: "Infoprodutos", status: "ativo", drafts: 24, approved: 8, official: 5, lastActivity: "2h atrás" },
  { id: "2", name: "E-commerce Natura", niche: "Cosméticos", status: "ativo", drafts: 12, approved: 15, official: 22, lastActivity: "5h atrás" },
  { id: "3", name: "SaaS Dashboard", niche: "Tecnologia", status: "ativo", drafts: 7, approved: 3, official: 1, lastActivity: "1d atrás" },
  { id: "4", name: "Imobiliária Premium", niche: "Imóveis", status: "ativo", drafts: 31, approved: 12, official: 9, lastActivity: "3d atrás" },
  { id: "5", name: "Fitness Camp", niche: "Saúde", status: "ativo", drafts: 5, approved: 2, official: 0, lastActivity: "1sem atrás" },
  { id: "6", name: "Consultoria Financeira", niche: "Finanças", status: "arquivado", drafts: 0, approved: 18, official: 18, lastActivity: "2sem atrás" },
];

export default function Dashboard() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const filtered = mockProjects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.niche.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Projetos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gerencie todos os seus projetos criativos</p>
      </div>

      {/* Actions bar */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar projetos..."
            className="w-full rounded-md border border-border bg-secondary/50 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
        <button
          onClick={() => setWizardOpen(true)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors glow-cyan"
        >
          <Plus className="h-4 w-4" />
          Novo Projeto
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Projetos Ativos", value: mockProjects.filter((p) => p.status === "ativo").length, icon: FolderOpen },
          { label: "Total Rascunhos", value: mockProjects.reduce((a, p) => a + p.drafts, 0), icon: Zap },
          { label: "Ativos Oficiais", value: mockProjects.reduce((a, p) => a + p.official, 0), icon: Star },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-primary/10 p-2">
                <s.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Project grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {filtered.map((project, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/project/${project.id}/home`)}
              className="group cursor-pointer rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-sm">{project.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{project.niche}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${
                  project.status === "ativo" ? "bg-cos-success/10 text-cos-success" : "bg-muted text-muted-foreground"
                }`}>
                  {project.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{project.drafts} rascunhos</span>
                <span>{project.approved} aprovados</span>
                <span className="text-primary font-medium">{project.official} oficiais</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">{project.lastActivity}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); }}
                  className="rounded-md p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-secondary transition-all"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Wizard */}
      <CreateProjectWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
