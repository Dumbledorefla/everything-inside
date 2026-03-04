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

  const invokeWithTimeout = useCallback(async (
    functionName: string,
    body: Record<string, any>,
    timeoutMs = 120_000
  ) => {
    const invokePromise = supabase.functions.invoke(functionName, { body });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("A requisição demorou demais. Tente novamente.")), timeoutMs);
    });

    return await Promise.race([invokePromise, timeoutPromise]) as {
      data: any;
      error: any;
    };
  }, []);

  const generateStoryline = useCallback(async (params: {
    projectId: string;
    referenceId?: string;
    slideCount: number;
    topic?: string;
    profile: "economy" | "standard" | "quality" | "unrestricted";
    ratio: string;
    useCharacter?: boolean;
    characterImageUrl?: string;
  }) => {
    setStep("generating-storyline");
    setStoryline([]);
    setSlides([]);

    try {
      const { data, error } = await invokeWithTimeout("carousel-generate", {
        ...params,
        mode: "storyline",
        formula,
      }, 90_000);

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
  }, [formula, invokeWithTimeout]);

  const generateSlides = useCallback(async (params: {
    projectId: string;
    referenceId?: string;
    profile: "economy" | "standard" | "quality" | "unrestricted";
    ratio: string;
    useCharacter?: boolean;
    characterImageUrl?: string;
  }) => {
    if (!storyline.length) return;
    setStep("generating-slides");
    setSlides([]);

    try {
      const collected: CarouselSlideResult[] = [];
      let failed = 0;

      for (const slide of storyline) {
        const { data, error } = await invokeWithTimeout("carousel-generate", {
          ...params,
          mode: "generate",
          slideCount: 1,
          approvedStoryline: [slide],
          styleAnchor,
          formula: activeFormula,
        });

        const failureMessage = error?.message || data?.error;
        if (failureMessage) {
          failed += 1;
          collected.push({
            slideNumber: slide.slideNumber,
            role: slide.role,
            headline: slide.headline,
            body: slide.body,
            copyPlacement: slide.copyPlacement,
            imageUrl: null,
            error: failureMessage,
          });
        } else {
          const generatedSlide = data?.slides?.[0];
          if (generatedSlide) {
            collected.push(generatedSlide);
          } else {
            failed += 1;
            collected.push({
              slideNumber: slide.slideNumber,
              role: slide.role,
              headline: slide.headline,
              body: slide.body,
              copyPlacement: slide.copyPlacement,
              imageUrl: null,
              error: "Slide sem retorno da IA",
            });
          }
        }

        setSlides([...collected]);
      }

      setStep("done");
      if (failed > 0) {
        toast.warning(`${collected.length - failed} slides gerados e ${failed} falharam.`);
      } else {
        toast.success(`${collected.length} slides do carrossel gerados!`);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar slides");
      setStep("reviewing");
    }
  }, [storyline, styleAnchor, activeFormula, invokeWithTimeout]);

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
