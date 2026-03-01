import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  assetId: string;
  currentRating: number | null;
}

export default function AssetRating({ assetId, currentRating }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (rating: number) => {
      const { error } = await supabase
        .from("assets")
        .update({ rating } as any)
        .eq("id", assetId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-assets"] });
    },
  });

  const display = hover ?? currentRating ?? 0;

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(null)}
          onClick={() => mutation.mutate(star)}
          className={cn(
            "text-sm transition-all",
            star <= display ? "text-cos-warning" : "text-muted-foreground/20 hover:text-cos-warning/40"
          )}
        >
          ★
        </button>
      ))}
      {currentRating && (
        <span className="text-[9px] text-muted-foreground/50 font-mono ml-1">{currentRating}/5</span>
      )}
    </div>
  );
}
