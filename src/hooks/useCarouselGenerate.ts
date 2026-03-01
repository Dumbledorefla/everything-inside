import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type CarouselFormula = "pas" | "tutorial" | "hero_journey";

export interface SlideStoryline {
  slideNumber: number;
  role: string;
  headline: string;
  body?: string;
  visualDirection: string;
  copyPlacement: string;
}

export interface CarouselSlideResult {
  id?: string;
  slideNumber: number;
  role: string;
  headline: string;
  body?: string;
  imageUrl: string | null;
  copyPlacement: string;
  error?: string;
}

export type CarouselStep = "idle" | "generating-storyline" | "reviewing" | "generating-slides" | "done";

export function useCarouselGenerate() {
  const [step, setStep] = useState<CarouselStep>("idle");
  const [storyline, setStoryline] = useState<SlideStoryline[]>([]);
  const [styleAnchor, setStyleAnchor] = useState("");
  const [slides, setSlides] = useState<CarouselSlideResult[]>([]);
  const [formula, setFormula] = useState<CarouselFormula>("tutorial");
  const [activeFormula, setActiveFormula] = useState<CarouselFormula>("tutorial");

  const generateStoryline = useCallback(async (params: {
    projectId: string;
    referenceId?: string;
    slideCount: number;
    topic?: string;
    profile: "economy" | "standard" | "quality";
    ratio: string;
  }) => {
    setStep("generating-storyline");
    setStoryline([]);
    setSlides([]);

    try {
      const { data, error } = await supabase.functions.invoke("carousel-generate", {
        body: { ...params, mode: "storyline", formula },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setStoryline(data.storyline || []);
      setStyleAnchor(data.styleAnchor || "");
      setActiveFormula(data.formula || formula);
      setStep("reviewing");
      toast.success(`Roteiro "${formulaLabel(data.formula || formula)}" com ${data.storyline?.length || 0} slides gerado!`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar roteiro");
      setStep("idle");
    }
  }, [formula]);

  const generateSlides = useCallback(async (params: {
    projectId: string;
    referenceId?: string;
    profile: "economy" | "standard" | "quality";
    ratio: string;
  }) => {
    if (!storyline.length) return;
    setStep("generating-slides");

    try {
      const { data, error } = await supabase.functions.invoke("carousel-generate", {
        body: {
          ...params,
          mode: "generate",
          slideCount: storyline.length,
          approvedStoryline: storyline,
          styleAnchor,
          formula: activeFormula,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSlides(data.slides || []);
      setStep("done");
      toast.success(`${data.slides?.length || 0} slides do carrossel gerados!`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar slides");
      setStep("reviewing");
    }
  }, [storyline, styleAnchor, activeFormula]);

  const reset = useCallback(() => {
    setStep("idle");
    setStoryline([]);
    setStyleAnchor("");
    setSlides([]);
  }, []);

  const updateSlide = useCallback((index: number, updates: Partial<SlideStoryline>) => {
    setStoryline((prev) => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  }, []);

  return { step, storyline, styleAnchor, slides, formula, setFormula, activeFormula, generateStoryline, generateSlides, reset, updateSlide };
}

function formulaLabel(f: string): string {
  const labels: Record<string, string> = { pas: "PAS (Dor → Solução)", tutorial: "Tutorial/Lista", hero_journey: "Jornada do Herói" };
  return labels[f] || f;
}
