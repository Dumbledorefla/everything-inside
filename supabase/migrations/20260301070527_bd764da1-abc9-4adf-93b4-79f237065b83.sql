
-- Brand Kits table
CREATE TABLE public.brand_kits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  color_palette JSONB NOT NULL DEFAULT '[]'::jsonb,
  typography JSONB NOT NULL DEFAULT '{}'::jsonb,
  editorial_line JSONB NOT NULL DEFAULT '[]'::jsonb,
  moodboard_urls TEXT[] DEFAULT '{}'::text[],
  status TEXT NOT NULL DEFAULT 'generating',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT brand_kits_project_unique UNIQUE (project_id)
);

ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own brand kits"
  ON public.brand_kits FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add scheduling columns to assets
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS platform TEXT;

-- Add is_custom_model flag to templates
ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS is_custom_model BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_asset_id UUID REFERENCES public.assets(id),
  ADD COLUMN IF NOT EXISTS template_content JSONB DEFAULT '{}'::jsonb;
