import { motion } from "framer-motion";
import { Save, Palette, Type, Ruler, Image as ImageIcon } from "lucide-react";

const dnaFields = [
  { section: "Identidade", fields: [
    { label: "Nome do Projeto", value: "Lançamento Expert Pro" },
    { label: "Nicho", value: "Infoprodutos / Marketing Digital" },
    { label: "Produto", value: "Curso Expert Pro 2.0" },
  ]},
  { section: "Público e Voz", fields: [
    { label: "Público Principal", value: "Empreendedores digitais iniciantes" },
    { label: "Dor Principal", value: "Não conseguem vender online de forma consistente" },
    { label: "Promessa", value: "Faturar R$10k em 90 dias com método validado" },
    { label: "Tom de Voz", value: "Profissional" },
  ]},
  { section: "Estratégia", fields: [
    { label: "Públicos Secundários", value: "Freelancers, coaches, consultores" },
    { label: "Objeções", value: "\"Não tenho tempo\", \"Já tentei e não funcionou\"" },
    { label: "Provas Sociais", value: "5.000+ alunos, 87% taxa de conclusão" },
    { label: "CTA Padrão", value: "Quero começar agora →" },
    { label: "Palavras Proibidas", value: "fácil, grátis, milagre" },
    { label: "Pilares de Conteúdo", value: "Autoridade, Prova, Urgência, Transformação" },
  ]},
];

const designTokens = {
  colors: [
    { name: "Primária", hex: "#06B6D4" },
    { name: "Secundária", hex: "#8B5CF6" },
    { name: "Acento", hex: "#F59E0B" },
    { name: "Fundo", hex: "#0F172A" },
    { name: "Texto", hex: "#E2E8F0" },
  ],
  fonts: [
    { role: "Headline", family: "JetBrains Mono", weight: "Bold", size: "32px" },
    { role: "Corpo", family: "Inter", weight: "Regular", size: "16px" },
    { role: "CTA", family: "Inter", weight: "Semibold", size: "14px" },
  ],
};

export default function ProjectDNA() {
  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">DNA do Projeto</h1>
          <p className="text-xs text-muted-foreground mt-1">Identidade estratégica e visual do projeto</p>
        </div>
        <button className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Save className="h-3.5 w-3.5" />
          Salvar
        </button>
      </div>

      {/* DNA Fields */}
      {dnaFields.map((section, si) => (
        <motion.div
          key={section.section}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: si * 0.1 }}
          className="mb-6 rounded-lg border border-border bg-card p-5"
        >
          <h2 className="text-sm font-semibold mb-4">{section.section}</h2>
          <div className="space-y-3">
            {section.fields.map((f) => (
              <div key={f.label}>
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">{f.label}</label>
                <input
                  type="text"
                  defaultValue={f.value}
                  className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            ))}
          </div>
        </motion.div>
      ))}

      {/* Design Tokens */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-lg border border-border bg-card p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Palette className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Design Tokens</h2>
        </div>

        {/* Colors */}
        <div className="mb-5">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 block">Cores</label>
          <div className="flex gap-3">
            {designTokens.colors.map((c) => (
              <div key={c.name} className="flex flex-col items-center gap-1.5">
                <div className="h-10 w-10 rounded-lg border border-border" style={{ backgroundColor: c.hex }} />
                <span className="text-[10px] text-muted-foreground">{c.name}</span>
                <span className="text-[9px] font-mono text-muted-foreground">{c.hex}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fonts */}
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 block">Tipografia</label>
          <div className="space-y-2">
            {designTokens.fonts.map((f) => (
              <div key={f.role} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div className="flex items-center gap-3">
                  <Type className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">{f.role}</span>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">{f.family} · {f.weight} · {f.size}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
