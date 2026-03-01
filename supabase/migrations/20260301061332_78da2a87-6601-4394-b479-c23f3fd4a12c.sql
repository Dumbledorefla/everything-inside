
-- ══════════════════════════════════════════════════════════════
-- 1. Saved Templates (Modelos Salvos)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.saved_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'copy',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own templates"
  ON public.saved_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_saved_templates_updated_at
  BEFORE UPDATE ON public.saved_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ══════════════════════════════════════════════════════════════
-- 2. Project Memory (Memória Adaptativa)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.project_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  pattern TEXT NOT NULL,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  occurrences INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own memory"
  ON public.project_memory FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_project_memory_updated_at
  BEFORE UPDATE ON public.project_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ══════════════════════════════════════════════════════════════
-- 3. Activity Log (Histórico)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own activity"
  ON public.activity_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own activity"
  ON public.activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════
-- 4. Pages (Ativo Composto - Páginas)
-- ══════════════════════════════════════════════════════════════
CREATE TYPE public.page_type AS ENUM (
  'sales', 'landing', 'vsl', 'presell', 'advertorial', 'checkout', 'thankyou', 'ecommerce'
);

CREATE TABLE public.pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  page_type public.page_type NOT NULL DEFAULT 'sales',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pages"
  ON public.pages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_pages_updated_at
  BEFORE UPDATE ON public.pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.page_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  selected_variant_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.page_sections ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_page_owner(p_page_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pages WHERE id = p_page_id AND user_id = auth.uid()
  );
$$;

CREATE POLICY "Users manage own page sections"
  ON public.page_sections FOR ALL
  USING (is_page_owner(page_id))
  WITH CHECK (is_page_owner(page_id));

CREATE TABLE public.page_section_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES public.page_sections(id) ON DELETE CASCADE,
  headline TEXT,
  body TEXT,
  cta TEXT,
  image_url TEXT,
  style JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.page_section_variants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_section_owner(p_section_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.page_sections ps
    JOIN public.pages p ON p.id = ps.page_id
    WHERE ps.id = p_section_id AND p.user_id = auth.uid()
  );
$$;

CREATE POLICY "Users manage own section variants"
  ON public.page_section_variants FOR ALL
  USING (is_section_owner(section_id))
  WITH CHECK (is_section_owner(section_id));

-- ══════════════════════════════════════════════════════════════
-- 5. Storage bucket for assets
-- ══════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public) VALUES ('assets', 'assets', true);

CREATE POLICY "Anyone can view assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'assets');

CREATE POLICY "Authenticated users upload assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'assets' AND auth.role() = 'authenticated');

CREATE POLICY "Users delete own assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'assets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ══════════════════════════════════════════════════════════════
-- 6. Auto-create folders on project creation
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.auto_create_project_folders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.library_folders (project_id, user_id, name) VALUES
    (NEW.id, NEW.user_id, 'Ativos Oficiais'),
    (NEW.id, NEW.user_id, 'Exploração'),
    (NEW.id, NEW.user_id, 'Sprints'),
    (NEW.id, NEW.user_id, 'Modelos'),
    (NEW.id, NEW.user_id, 'Referências'),
    (NEW.id, NEW.user_id, 'Arquivados');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_created_auto_folders
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_project_folders();
