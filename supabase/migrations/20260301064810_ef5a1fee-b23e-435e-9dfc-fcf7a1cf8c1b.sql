
-- ═══ MODULE 1: Templates table ═══
CREATE TABLE public.templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID,
  name TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL DEFAULT '1:1',
  safe_zones JSONB NOT NULL DEFAULT '{"top": 10, "bottom": 20, "left": 10, "right": 10}',
  slots JSONB NOT NULL DEFAULT '{}',
  brand_overlay BOOLEAN NOT NULL DEFAULT true,
  niche_style TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own templates_canvas"
  ON public.templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══ MODULE 1: Add render fields to assets ═══
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS final_render_url TEXT,
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.templates(id);

-- ═══ MODULE 4: Pending DNA updates table ═══
CREATE TABLE public.pending_dna_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  suggestion_text TEXT NOT NULL,
  json_patch JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_dna_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dna updates"
  ON public.pending_dna_updates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
