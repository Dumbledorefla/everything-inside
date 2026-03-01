import { Library, Search } from "lucide-react";

export default function GlobalLibrary() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold tracking-tight mb-2">Biblioteca Global</h1>
      <p className="text-sm text-muted-foreground mb-6">Busca transversal por todos os projetos</p>
      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar ativos em todos os projetos..." className="w-full rounded-md border border-border bg-secondary/50 py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
      </div>
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <Library className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">Selecione um filtro ou faça uma busca para visualizar ativos</p>
      </div>
    </div>
  );
}
