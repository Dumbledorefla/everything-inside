import { FileStack, Search } from "lucide-react";

export default function Models() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold tracking-tight mb-2">Modelos</h1>
      <p className="text-sm text-muted-foreground mb-6">Modelos globais para padronização de conteúdo</p>
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <FileStack className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">Nenhum modelo criado ainda. Aprove um item e salve como modelo.</p>
      </div>
    </div>
  );
}
