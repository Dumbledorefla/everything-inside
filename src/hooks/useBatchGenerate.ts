import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BATCH_SIZE = 1;
const REQUEST_TIMEOUT_MS = 120_000;

export interface BatchResult {
  id: string;
  headline: string;
  body: string;
  cta: string;
  imageUrl: string | null;
  provider: string;
  profile: string;
  status: string;
  creditCost: number;
  fallbackEvents?: string[];
  copyText?: string | null;
}

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  running: boolean;
}

interface BatchGenerateParams {
  projectId: string;
  mode: string;
  output: string;
  pieceType: string;
  quantity: number;
  profile: string;
  provider: string;
  destination: string;
  ratio: string;
  intensity: string;
  useModel: boolean;
  useVisualProfile: boolean;
  userPrompt?: string;
  operationMode?: string;
  formatLabel?: string;
  copyTone?: string;
}

export function useBatchGenerate() {
  const [results, setResults] = useState<BatchResult[]>([]);
  const [progress, setProgress] = useState<BatchProgress>({
    total: 0, completed: 0, failed: 0, running: false,
  });
  const abortRef = useRef(false);

  const cancel = useCallback(() => {
    abortRef.current = true;
  }, []);

  const invokeWithTimeout = useCallback(async (body: Record<string, any>) => {
    const invokePromise = supabase.functions.invoke("cos-generate", { body });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Tempo limite ao conectar com o backend.")), REQUEST_TIMEOUT_MS);
    });

    return await Promise.race([invokePromise, timeoutPromise]) as {
      data: any;
      error: any;
    };
  }, []);

  const generate = useCallback(async (params: BatchGenerateParams) => {
    const { quantity, ...rest } = params;
    const totalBatches = Math.ceil(quantity / BATCH_SIZE);

    abortRef.current = false;
    setResults([]);
    setProgress({ total: quantity, completed: 0, failed: 0, running: true });

    let allResults: BatchResult[] = [];
    let completedCount = 0;
    let failedCount = 0;

    for (let b = 0; b < totalBatches; b++) {
      if (abortRef.current) {
        toast.info(`Geração cancelada. ${completedCount} variações salvas.`);
        break;
      }

      const batchQty = Math.min(BATCH_SIZE, quantity - b * BATCH_SIZE);

      try {
        const { data, error } = await invokeWithTimeout({ ...rest, quantity: batchQty });

        if (error) throw error;
        if (data?.error) {
          failedCount += batchQty;
          toast.error(`Lote ${b + 1}: ${data.error}`);
        } else {
          const batchResults: BatchResult[] = data.results || [];
          completedCount += batchResults.length;
          failedCount += batchQty - batchResults.length;
          allResults = [...allResults, ...batchResults];
          setResults((prev) => [...prev, ...batchResults]);

          if (data.fallbackLog?.length > 0) {
            toast.warning(`Lote ${b + 1}: Fallback ativado`);
          }
        }
      } catch (e: any) {
        failedCount += batchQty;
        console.error(`Batch ${b + 1} error:`, e);
        toast.error(`Lote ${b + 1} falhou: ${e?.message || "Erro de conexão"}`);
      }

      setProgress({ total: quantity, completed: completedCount, failed: failedCount, running: !abortRef.current });
    }

    const totalCredits = allResults.reduce((s, r) => s + r.creditCost, 0);
    if (completedCount > 0) {
      toast.success(`${completedCount} variações geradas (${totalCredits} créditos)`);
    }

    setProgress((p) => ({ ...p, running: false }));
    return allResults;
  }, [invokeWithTimeout]);

  return { results, progress, generate, cancel, setResults };
}
