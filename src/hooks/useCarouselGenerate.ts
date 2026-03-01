import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
        body: { ...params, mode: "storyline" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setStoryline(data.storyline || []);
      setStyleAnchor(data.styleAnchor || "");
      setStep("reviewing");
      toast.success(`Roteiro com ${data.storyline?.length || 0} slides gerado!`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar roteiro");
      setStep("idle");
    }
  }, []);

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
  }, [storyline, styleAnchor]);

  const reset = useCallback(() => {
    setStep("idle");
    setStoryline([]);
    setStyleAnchor("");
    setSlides([]);
  }, []);

  const updateSlide = useCallback((index: number, updates: Partial<SlideStoryline>) => {
    setStoryline((prev) => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  }, []);

  return { step, storyline, styleAnchor, slides, generateStoryline, generateSlides, reset, updateSlide };
}
