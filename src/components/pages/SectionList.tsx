import { motion } from "framer-motion";
import { CheckCircle2, Zap, Loader2, GripVertical } from "lucide-react";

const sectionLabels: Record<string, string> = {
  hero: "Hero", dor: "Dor / Problema", mecanismo: "Mecanismo", prova: "Prova Social",
  depoimentos: "Depoimentos", oferta: "Oferta", garantia: "Garantia", faq: "FAQ",
  cta: "CTA Final", comparativo: "Comparativo", bonus: "Bônus",
};

interface Section {
  id: string;
  section_type: string;
  sort_order: number;
  status: string;
  selected_variant_id: string | null;
  page_section_variants?: any[];
}

interface SectionListProps {
  sections: Section[];
  selectedSectionId: string | null;
  onSelect: (id: string) => void;
  generatingSection: string | null;
  onGenerateSection: (sectionId: string) => void;
}

export default function SectionList({
  sections, selectedSectionId, onSelect, generatingSection, onGenerateSection,
}: SectionListProps) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Seções da Página
      </h3>
      {sections.map((s, i) => {
        const variantCount = s.page_section_variants?.length || 0;
        const isSelected = selectedSectionId === s.id;
        const isGenerating = generatingSection === s.id;

        return (
          <motion.button
            key={s.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => onSelect(s.id)}
            className={`w-full flex items-center gap-2 rounded-md px-3 py-2.5 text-left transition-all text-xs group ${
              isSelected
                ? "bg-primary/10 border border-primary/30 text-primary"
                : "bg-card border border-border hover:bg-secondary/50 text-foreground"
            }`}
          >
            <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            {s.status === "approved" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
            ) : (
              <Zap className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate text-xs">
                {sectionLabels[s.section_type] || s.section_type}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {variantCount} variantes · {s.status}
              </p>
            </div>
            {variantCount === 0 && !isGenerating && (
              <button
                onClick={(e) => { e.stopPropagation(); onGenerateSection(s.id); }}
                className="shrink-0 rounded px-2 py-1 text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                Gerar
              </button>
            )}
            {isGenerating && <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />}
          </motion.button>
        );
      })}
    </div>
  );
}
