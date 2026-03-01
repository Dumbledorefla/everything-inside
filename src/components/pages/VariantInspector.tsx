import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

const sectionLabels: Record<string, string> = {
  hero: "Hero", dor: "Dor / Problema", mecanismo: "Mecanismo", prova: "Prova Social",
  depoimentos: "Depoimentos", oferta: "Oferta", garantia: "Garantia", faq: "FAQ",
  cta: "CTA Final", comparativo: "Comparativo", bonus: "Bônus",
};

interface Variant {
  id: string;
  headline: string | null;
  body: string | null;
  cta: string | null;
  image_url: string | null;
}

interface VariantInspectorProps {
  section: {
    id: string;
    section_type: string;
    status: string;
    selected_variant_id: string | null;
    page_section_variants?: Variant[];
  };
  onApprove: (sectionId: string, variantId: string) => void;
}

export default function VariantInspector({ section, onApprove }: VariantInspectorProps) {
  const variants = section.page_section_variants || [];
  const [activeIndex, setActiveIndex] = useState(0);

  if (variants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <Sparkles className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">Nenhuma variante gerada</p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          Clique em "Gerar" na seção à esquerda ou use o "Assembler" para gerar todas
        </p>
      </div>
    );
  }

  const current = variants[activeIndex];
  const isApproved = section.selected_variant_id === current?.id;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold">
            {sectionLabels[section.section_type] || section.section_type}
          </h3>
          <p className="text-[10px] text-muted-foreground">
            Variante {activeIndex + 1} de {variants.length} · {section.status}
          </p>
        </div>
        {/* Carousel nav */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))}
            disabled={activeIndex === 0}
            className="rounded-md p-1.5 hover:bg-secondary disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {variants.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`h-2 w-2 rounded-full transition-all ${
                i === activeIndex ? "bg-primary scale-125" : "bg-muted-foreground/30"
              }`}
            />
          ))}
          <button
            onClick={() => setActiveIndex(Math.min(variants.length - 1, activeIndex + 1))}
            disabled={activeIndex === variants.length - 1}
            className="rounded-md p-1.5 hover:bg-secondary disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Variant content */}
      <div className="flex-1 overflow-auto p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={current?.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Image preview */}
            {current?.image_url && (
              <div className="rounded-lg overflow-hidden border border-border aspect-video">
                <img src={current.image_url} alt="" className="w-full h-full object-cover" />
              </div>
            )}

            {/* Text content */}
            <div className={`rounded-lg border p-5 space-y-3 ${
              isApproved ? "border-green-500/40 bg-green-500/5" : "border-border bg-card"
            }`}>
              {isApproved && (
                <div className="flex items-center gap-1.5 text-green-500 text-[10px] font-medium mb-2">
                  <CheckCircle2 className="h-3 w-3" /> Variante aprovada
                </div>
              )}
              {current?.headline && (
                <h4 className="text-base font-bold leading-tight">{current.headline}</h4>
              )}
              {current?.body && (
                <p className="text-sm text-muted-foreground leading-relaxed">{current.body}</p>
              )}
              {current?.cta && (
                <div className="pt-1">
                  <span className="inline-block rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
                    {current.cta}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Approve button */}
      {current && !isApproved && (
        <div className="p-4 border-t border-border">
          <button
            onClick={() => onApprove(section.id, current.id)}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-green-600 hover:bg-green-700 px-4 py-2.5 text-xs font-semibold text-white transition-colors"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Aprovar esta variante
          </button>
        </div>
      )}
    </div>
  );
}
