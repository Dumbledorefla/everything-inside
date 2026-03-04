
-- Tabela para armazenar fotos de referência reais do usuário por projeto
CREATE TABLE public.reference_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  photo_url TEXT NOT NULL,
  label TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.reference_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own reference photos"
ON public.reference_photos FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Adiciona colunas na tabela projects
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS use_real_photos BOOLEAN DEFAULT false;

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS primary_reference_photo_url TEXT;

-- Tabela para jobs do Studio Adulto
CREATE TABLE public.adult_studio_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  mode TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt TEXT NOT NULL,
  reference_photo_url TEXT,
  lora_model_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  result_url TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.adult_studio_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own adult studio jobs"
ON public.adult_studio_jobs FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_adult_studio_jobs_updated_at
BEFORE UPDATE ON public.adult_studio_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.reference_photos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.adult_studio_jobs;
