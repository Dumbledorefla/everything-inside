import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, ArrowLeft, Check, Upload, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const steps = ["Essencial", "Público e Voz", "Visual"];
const toneOptions = ["Profissional", "Casual", "Agressivo", "Inspiracional", "Técnico", "Divertido"];
const styleOptions = ["Minimalista", "Bold", "Clean", "Premium", "Urbano", "Orgânico", "Futurista", "Clássico"];

export default function CreateProjectWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "", niche: "", product: "",
    audience: "", pain: "", promise: "", tone: "",
    colors: [] as string[], style: [] as string[],
  });
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const update = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));
  const toggleStyle = (s: string) =>
    setForm((f) => ({
      ...f,
      style: f.style.includes(s) ? f.style.filter((x) => x !== s) : [...f.style, s],
    }));

  const canNext = step === 0 ? form.name && form.niche : step === 1 ? form.audience && form.pain : true;

  const createMutation = useMutation({
    mutationFn: async () => {
      // 1. Create project
      const { data: project, error: projErr } = await supabase
        .from("projects")
        .insert({
          user_id: user!.id,
          name: form.name,
          niche: form.niche,
          product: form.product,
          description: form.promise,
        })
        .select()
        .single();
      if (projErr) throw projErr;

      // 2. Create initial DNA v1
      const { error: dnaErr } = await supabase
        .from("project_dna")
        .insert({
          project_id: project.id,
          version: 1,
          identity: { name: form.name, niche: form.niche, product: form.product },
          audience: { target: form.audience, pain: form.pain, promise: form.promise },
          strategy: { tone: form.tone },
          visual: { colors: form.colors, styles: form.style },
          funnel: {},
        });
      if (dnaErr) throw dnaErr;

      return project;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projeto criado!");
      resetAndClose();
      navigate(`/project/${project.id}/home`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao criar projeto");
    },
  });

  const resetAndClose = () => {
    setStep(0);
    setForm({ name: "", niche: "", product: "", audience: "", pain: "", promise: "", tone: "", colors: [], style: [] });
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        onClick={resetAndClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl"
        >
          <button onClick={resetAndClose} className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>

          <h2 className="text-lg font-bold mb-1">Novo Projeto</h2>
          <p className="text-xs text-muted-foreground mb-6">Passo {step + 1} de 3 — {steps[step]}</p>

          <div className="mb-6 flex gap-1">
            {steps.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-border"}`} />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              {step === 0 && (
                <>
                  <Field label="Nome do projeto" value={form.name} onChange={(v) => update("name", v)} placeholder="Ex: Lançamento Expert Pro" />
                  <Field label="Nicho / Subnicho" value={form.niche} onChange={(v) => update("niche", v)} placeholder="Ex: Infoprodutos / Marketing Digital" />
                  <Field label="Produto / Oferta" value={form.product} onChange={(v) => update("product", v)} placeholder="Ex: Curso Expert Pro 2.0" />
                </>
              )}
              {step === 1 && (
                <>
                  <Field label="Público principal" value={form.audience} onChange={(v) => update("audience", v)} placeholder="Ex: Empreendedores digitais iniciantes" />
                  <Field label="Dor principal" value={form.pain} onChange={(v) => update("pain", v)} placeholder="Ex: Não conseguem vender online" />
                  <Field label="Promessa principal" value={form.promise} onChange={(v) => update("promise", v)} placeholder="Ex: Faturar R$10k em 90 dias" />
                  <div>
                    <label className="text-xs font-medium text-foreground mb-2 block">Tom de voz</label>
                    <div className="flex flex-wrap gap-2">
                      {toneOptions.map((t) => (
                        <button key={t} onClick={() => update("tone", t)}
                          className={`rounded-md border px-3 py-1.5 text-xs transition-all ${form.tone === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  <div>
                    <label className="text-xs font-medium text-foreground mb-2 block">Paleta de cores</label>
                    <div className="flex gap-3">
                      {["#06B6D4", "#8B5CF6", "#F59E0B", "#EF4444", "#10B981"].map((c) => (
                        <button key={c} onClick={() => update("colors", form.colors.includes(c) ? form.colors.filter((x: string) => x !== c) : [...form.colors, c])}
                          className={`h-8 w-8 rounded-full border-2 transition-all ${form.colors.includes(c) ? "border-foreground scale-110" : "border-transparent"}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground mb-2 block">Estilo visual</label>
                    <div className="flex flex-wrap gap-2">
                      {styleOptions.map((s) => (
                        <button key={s} onClick={() => toggleStyle(s)}
                          className={`rounded-md border px-3 py-1.5 text-xs transition-all ${form.style.includes(s) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-dashed border-border p-6 text-center">
                    <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">Arraste referências visuais ou clique para upload</p>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex items-center justify-between">
            <button onClick={() => step > 0 && setStep(step - 1)}
              className={`flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors ${step === 0 ? "invisible" : ""}`}>
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </button>
            {step < 2 ? (
              <button onClick={() => canNext && setStep(step + 1)} disabled={!canNext}
                className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors">
                Próximo <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
                className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors glow-cyan disabled:opacity-50">
                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Criar Projeto
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground mb-1.5 block">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
    </div>
  );
}
