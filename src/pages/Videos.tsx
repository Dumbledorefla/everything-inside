import { useState } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Video, Sparkles, Megaphone, MessageCircle, Star, Loader2, Download, Play, Image, FileText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DURATION_OPTIONS = ["5", "10"];
const ASPECT_OPTIONS = ["16:9", "9:16", "1:1", "4:3"];
const VOICE_OPTIONS = ["Bella", "Rachel", "Josh", "Sam", "Dorothy", "Antoni", "Elli", "Callum"];

export default function Videos() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Freeform state
  const [freePrompt, setFreePrompt] = useState("");
  const [freeImageUrl, setFreeImageUrl] = useState("");
  const [freeDuration, setFreeDuration] = useState("5");
  const [freeAspect, setFreeAspect] = useState("16:9");
  const [freeNegative, setFreeNegative] = useState("");

  // Quick Ad state
  const [adAssetId, setAdAssetId] = useState("");
  const [adHeadline, setAdHeadline] = useState("");

  // Avatar state
  const [avatarAssetId, setAvatarAssetId] = useState("");
  const [avatarScript, setAvatarScript] = useState("");
  const [avatarVoice, setAvatarVoice] = useState("Bella");

  // Testimonial state
  const [testAssetId, setTestAssetId] = useState("");
  const [testScript, setTestScript] = useState("");
  const [testVoice, setTestVoice] = useState("Rachel");

  // Fetch project assets for selectors
  const { data: projectAssets = [] } = useQuery({
    queryKey: ["project-assets-for-video", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("assets")
        .select("id, title, output, persona_type, status")
        .eq("project_id", projectId!)
        .in("output", ["image", "both"])
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!projectId,
  });

  // Fetch videos
  const { data: videos = [], isLoading: videosLoading } = useQuery({
    queryKey: ["project-videos", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("videos")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!projectId,
  });

  // Character assets
  const characterAssets = projectAssets.filter((a: any) => a.persona_type === "influencer" || a.persona_type === "character");
  const evalAssets = projectAssets.filter((a: any) => a.persona_type === "evaluation");


  const generateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await supabase.functions.invoke("video-generate", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Vídeo gerado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["project-videos", projectId] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao gerar vídeo"),
  });

  const handleFreeform = () => {
    if (!freePrompt.trim()) return toast.error("Descreva o vídeo desejado");
    generateMutation.mutate({
      mode: "freeform",
      project_id: projectId,
      prompt: freePrompt,
      duration: freeDuration,
      aspect_ratio: freeAspect,
      image_url: freeImageUrl || undefined,
      negative_prompt: freeNegative || undefined,
    });
  };

  const handleQuickAd = () => {
    if (!adAssetId) return toast.error("Selecione um ativo da biblioteca");
    generateMutation.mutate({
      mode: "quick_ad",
      project_id: projectId,
      source_asset_id: adAssetId,
      headline_text: adHeadline,
    });
  };

  const handleAvatar = () => {
    if (!avatarAssetId || !avatarScript.trim()) return toast.error("Selecione um personagem e escreva o script");
    generateMutation.mutate({
      mode: "talking_avatar",
      project_id: projectId,
      character_asset_id: avatarAssetId,
      script_text: avatarScript,
      voice_id: avatarVoice,
    });
  };

  const handleTestimonial = () => {
    if (!testAssetId || !testScript.trim()) return toast.error("Selecione um personagem e escreva o depoimento");
    generateMutation.mutate({
      mode: "testimonial",
      project_id: projectId,
      character_asset_id: testAssetId,
      script_text: testScript,
      voice_id: testVoice,
    });
  };

  const isPending = generateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Video className="h-6 w-6 text-primary" />
          Gerador de Vídeo
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Crie vídeos de alta qualidade com IA — Kling &amp; HeyGen via fal.ai</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="freeform" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="freeform" className="gap-1.5 text-xs"><Sparkles className="h-3.5 w-3.5" />Gerador Livre</TabsTrigger>
          <TabsTrigger value="quick_ad" className="gap-1.5 text-xs"><Megaphone className="h-3.5 w-3.5" />Anúncio Rápido</TabsTrigger>
          <TabsTrigger value="talking_avatar" className="gap-1.5 text-xs"><MessageCircle className="h-3.5 w-3.5" />Avatar Falante</TabsTrigger>
          <TabsTrigger value="testimonial" className="gap-1.5 text-xs"><Star className="h-3.5 w-3.5" />Depoimento</TabsTrigger>
        </TabsList>

        {/* Freeform Tab */}
        <TabsContent value="freeform">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-6 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Prompt do Vídeo</Label>
                <Textarea
                  value={freePrompt}
                  onChange={(e) => setFreePrompt(e.target.value)}
                  placeholder="Descreva o vídeo que deseja gerar em detalhes..."
                  className="min-h-[100px] bg-background/50"
                  disabled={isPending}
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">URL da Imagem (opcional, para image-to-video)</Label>
                <Input
                  value={freeImageUrl}
                  onChange={(e) => setFreeImageUrl(e.target.value)}
                  placeholder="https://..."
                  disabled={isPending}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Duração</Label>
                  <Select value={freeDuration} onValueChange={setFreeDuration} disabled={isPending}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map((d) => <SelectItem key={d} value={d}>{d} segundos</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Proporção</Label>
                  <Select value={freeAspect} onValueChange={setFreeAspect} disabled={isPending}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ASPECT_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Prompt Negativo (opcional)</Label>
                <Input
                  value={freeNegative}
                  onChange={(e) => setFreeNegative(e.target.value)}
                  placeholder="O que evitar no vídeo..."
                  disabled={isPending}
                />
              </div>

              <Button onClick={handleFreeform} disabled={isPending} className="w-full">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                Gerar Vídeo
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quick Ad Tab */}
        <TabsContent value="quick_ad">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-6 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Selecione um Ativo da Biblioteca</Label>
                <Select value={adAssetId} onValueChange={setAdAssetId} disabled={isPending}>
                  <SelectTrigger><SelectValue placeholder="Escolha uma imagem..." /></SelectTrigger>
                  <SelectContent>
                    {projectAssets.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{a.title || `Ativo ${a.id.slice(0, 8)}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Headline do Anúncio</Label>
                <Input
                  value={adHeadline}
                  onChange={(e) => setAdHeadline(e.target.value)}
                  placeholder="Texto principal do anúncio..."
                  disabled={isPending}
                />
              </div>

              <Button onClick={handleQuickAd} disabled={isPending} className="w-full">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Megaphone className="h-4 w-4 mr-2" />}
                Animar Anúncio
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Talking Avatar Tab */}
        <TabsContent value="talking_avatar">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-6 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Personagem do Projeto</Label>
                <Select value={avatarAssetId} onValueChange={setAvatarAssetId} disabled={isPending}>
                  <SelectTrigger><SelectValue placeholder="Selecione um personagem..." /></SelectTrigger>
                  <SelectContent>
                    {characterAssets.length === 0 && <SelectItem value="__none" disabled>Nenhum personagem encontrado</SelectItem>}
                    {characterAssets.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{a.title || `Personagem ${a.id.slice(0, 8)}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Script do Avatar</Label>
                <Textarea
                  value={avatarScript}
                  onChange={(e) => setAvatarScript(e.target.value)}
                  placeholder="Escreva o que o avatar deve falar..."
                  className="min-h-[100px] bg-background/50"
                  disabled={isPending}
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Voz</Label>
                <Select value={avatarVoice} onValueChange={setAvatarVoice} disabled={isPending}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VOICE_OPTIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleAvatar} disabled={isPending} className="w-full">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageCircle className="h-4 w-4 mr-2" />}
                Gerar Vídeo de Avatar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Testimonial Tab */}
        <TabsContent value="testimonial">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-6 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Personagem para Avaliação</Label>
                <Select value={testAssetId} onValueChange={setTestAssetId} disabled={isPending}>
                  <SelectTrigger><SelectValue placeholder="Selecione um personagem de avaliação..." /></SelectTrigger>
                  <SelectContent>
                    {evalAssets.length === 0 && <SelectItem value="__none" disabled>Nenhum personagem de avaliação encontrado</SelectItem>}
                    {evalAssets.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{a.title || `Avaliação ${a.id.slice(0, 8)}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Script do Depoimento</Label>
                <Textarea
                  value={testScript}
                  onChange={(e) => setTestScript(e.target.value)}
                  placeholder="Escreva o depoimento que o personagem irá falar..."
                  className="min-h-[100px] bg-background/50"
                  disabled={isPending}
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Voz</Label>
                <Select value={testVoice} onValueChange={setTestVoice} disabled={isPending}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VOICE_OPTIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleTestimonial} disabled={isPending} className="w-full">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Star className="h-4 w-4 mr-2" />}
                Gerar Depoimento
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Video Gallery */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Video className="h-4 w-4 text-primary" />
          Galeria de Vídeos
          {videos.length > 0 && <span className="text-xs text-muted-foreground font-normal">({videos.length})</span>}
        </h2>

        {videosLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Video className="h-8 w-8 text-primary/60" />
            </div>
            <p className="text-sm text-muted-foreground">Nenhum vídeo gerado ainda</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Use as abas acima para criar seu primeiro vídeo</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((v: any) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VideoCard({ video }: { video: any }) {
  const typeLabels: Record<string, string> = {
    freeform: "Gerador Livre",
    quick_ad: "Anúncio Rápido",
    talking_avatar: "Avatar Falante",
    testimonial: "Depoimento",
  };
  const statusColors: Record<string, string> = {
    completed: "bg-green-500/20 text-green-400",
    processing: "bg-yellow-500/20 text-yellow-400",
    failed: "bg-red-500/20 text-red-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/50 bg-card/80 overflow-hidden group"
    >
      <div className="aspect-video bg-muted/30 relative flex items-center justify-center">
        {video.video_url ? (
          <video
            src={video.video_url}
            controls
            className="w-full h-full object-cover"
            preload="metadata"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-xs">Processando...</span>
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <p className="text-sm font-medium truncate">{video.title || "Sem título"}</p>
        <div className="flex items-center justify-between">
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusColors[video.status] || "bg-muted text-muted-foreground")}>
            {video.status === "completed" ? "Concluído" : video.status === "processing" ? "Processando" : "Erro"}
          </span>
          <span className="text-[10px] text-muted-foreground">{typeLabels[video.video_type] || video.video_type}</span>
        </div>
        {video.video_url && (
          <a
            href={video.video_url}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
          >
            <Download className="h-3 w-3" />
            Download
          </a>
        )}
      </div>
    </motion.div>
  );
}
