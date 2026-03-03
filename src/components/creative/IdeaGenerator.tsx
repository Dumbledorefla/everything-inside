import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wand2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Idea {
  headline: string;
  body: string;
}

interface IdeaGeneratorProps {
  projectId: string;
  pieceType: string;
  onIdeaSelected: (idea: { headline: string; body: string }) => void;
}

export function IdeaGenerator({ projectId, pieceType, onIdeaSelected }: IdeaGeneratorProps) {
  const [topic, setTopic] = useState("");
  const [ideas, setIdeas] = useState<Idea[]>([]);

  const { mutate: generateIdeas, isPending } = useMutation({
    mutationFn: async () => {
      if (!topic.trim()) {
        throw new Error("Por favor, insira um tópico para as ideias.");
      }
      const { data, error } = await supabase.functions.invoke("idea-generator", {
        body: { projectId, topic, pieceType },
      });

      if (error) throw new Error(error.message);
      if (!data?.ideias || data.ideias.length === 0) throw new Error("A IA não retornou ideias.");
      return data.ideias as Idea[];
    },
    onSuccess: (data) => {
      if (data) {
        setIdeas(data);
        toast.success("5 novas ideias geradas!");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao gerar ideias.");
    },
  });

  return (
    <div className="p-4 space-y-4 bg-card/50 rounded-lg border border-border/20">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Wand2 className="h-4 w-4 text-primary" /> Gerador de Ideias
      </h3>
      <Textarea
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Ex: A importância do arcano 'A Força' para superar desafios..."
        rows={2}
        className="text-xs"
      />
      <Button onClick={() => generateIdeas()} disabled={isPending} className="w-full gap-2">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        Gerar Ideias
      </Button>

      {ideas.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-border/10">
          {ideas.map((idea, index) => (
            <div key={index} className="p-3 rounded-md border border-border/15 bg-background/30 flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-semibold text-xs">{idea.headline}</p>
                <p className="text-xs text-muted-foreground/80 mt-1">{idea.body}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onIdeaSelected(idea)}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
