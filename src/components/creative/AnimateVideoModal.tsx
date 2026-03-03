import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Film, Loader2, Music, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AnimateVideoModalProps {
  assetId: string;
  imageUrl: string;
  onClose: () => void;
}

type AnimationStyle = "subtle_zoom" | "dynamic_pan" | "text_focus";
type MusicTrack = "corporate" | "ambient" | "energetic";
type VideoFormat = "9:16" | "1:1" | "4:5";

const ANIMATION_OPTIONS: { id: AnimationStyle; label: string; desc: string; icon: string }[] = [
  { id: "subtle_zoom", label: "Zoom Sutil", desc: "Zoom lento e elegante na imagem", icon: "🔍" },
  { id: "dynamic_pan", label: "Pan Dinâmico", desc: "Movimento lateral com energia", icon: "🎬" },
  { id: "text_focus", label: "Foco no Texto", desc: "Texto animado sobre a imagem", icon: "✍️" },
];

const MUSIC_OPTIONS: { id: MusicTrack; label: string; icon: string }[] = [
  { id: "corporate", label: "Corporativo", icon: "🏢" },
  { id: "ambient", label: "Ambiente", icon: "🌿" },
  { id: "energetic", label: "Energético", icon: "⚡" },
];

const FORMAT_OPTIONS: { id: VideoFormat; label: string }[] = [
  { id: "9:16", label: "Stories / Reels" },
  { id: "1:1", label: "Feed Quadrado" },
  { id: "4:5", label: "Feed Vertical" },
];

export function AnimateVideoModal({ assetId, imageUrl, onClose }: AnimateVideoModalProps) {
  const queryClient = useQueryClient();
  const [animationStyle, setAnimationStyle] = useState<AnimationStyle>("subtle_zoom");
  const [musicTrack, setMusicTrack] = useState<MusicTrack>("corporate");
  const [videoFormat, setVideoFormat] = useState<VideoFormat>("9:16");

  const { mutate: generateVideo, isPending } = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("video-generate", {
        body: { assetId, animationStyle, musicTrack, videoFormat },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Vídeo gerado e adicionado à biblioteca!");
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Film className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-base font-bold font-mono-brand">Animar para Vídeo</h2>
          <p className="text-xs text-muted-foreground">Transforme a imagem em um vídeo curto.</p>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-xl overflow-hidden border border-border/15 bg-black/20">
        <img src={imageUrl} alt="Preview" className="w-full h-40 object-cover" />
      </div>

      {/* Animation Style */}
      <div className="space-y-2">
        <label className="text-[11px] font-mono-brand uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> Estilo de Animação
        </label>
        <div className="space-y-1.5">
          {ANIMATION_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setAnimationStyle(opt.id)}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-all",
                animationStyle === opt.id
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/15 bg-card/20 hover:border-primary/20"
              )}
            >
              <span className="text-lg">{opt.icon}</span>
              <div className="flex-1">
                <p className={cn("text-xs font-semibold", animationStyle === opt.id ? "text-primary" : "text-foreground")}>
                  {opt.label}
                </p>
                <p className="text-[10px] text-muted-foreground/60">{opt.desc}</p>
              </div>
              {animationStyle === opt.id && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      </div>

      {/* Music Track */}
      <div className="space-y-2">
        <label className="text-[11px] font-mono-brand uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1">
          <Music className="h-3 w-3" /> Música de Fundo
        </label>
        <div className="flex gap-2">
          {MUSIC_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setMusicTrack(opt.id)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs transition-all",
                musicTrack === opt.id
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/15 text-muted-foreground/50 hover:border-primary/20"
              )}
            >
              <span className="text-lg">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Video Format */}
      <div className="space-y-2">
        <label className="text-[11px] font-mono-brand uppercase tracking-wider text-muted-foreground/60">
          Formato do Vídeo
        </label>
        <div className="flex gap-2">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setVideoFormat(opt.id)}
              className={cn(
                "flex-1 rounded-xl border py-2 text-xs transition-all",
                videoFormat === opt.id
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/15 text-muted-foreground/50 hover:border-primary/20"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <Button onClick={() => generateVideo()} disabled={isPending} className="w-full gap-2 py-3">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
        {isPending ? "Gerando vídeo... (pode levar 1-2 min)" : "Gerar Vídeo"}
      </Button>

      {isPending && (
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-center">
          <p className="text-xs text-muted-foreground/70">
            Isso pode levar 1-2 minutos. A API de vídeo está processando a animação...
          </p>
        </div>
      )}
    </div>
  );
}
