
-- =============================================
-- COS (Creative Operating System) — MVP Schema
-- =============================================

-- 1. ENUM TYPES
CREATE TYPE public.asset_status AS ENUM ('draft', 'review', 'approved', 'official', 'archived', 'error');
CREATE TYPE public.provider_type AS ENUM ('text', 'image');
CREATE TYPE public.profile_level AS ENUM ('economy', 'standard', 'quality');
CREATE TYPE public.output_type AS ENUM ('text', 'image', 'both');
CREATE TYPE public.sprint_status AS ENUM ('active', 'paused', 'completed');

-- 2. PROFILES (user metadata)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  default_profile_level public.profile_level DEFAULT 'standard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. PROJECTS
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  niche TEXT,
  product TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. PROJECT DNA (current state)
CREATE TABLE public.project_dna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  identity JSONB DEFAULT '{}',
  audience JSONB DEFAULT '{}',
  strategy JSONB DEFAULT '{}',
  visual JSONB DEFAULT '{}',
  funnel JSONB DEFAULT '{}',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, version)
);

-- 5. ASSETS
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT,
  status public.asset_status NOT NULL DEFAULT 'draft',
  output public.output_type NOT NULL DEFAULT 'both',
  preset TEXT DEFAULT '1:1',
  destination TEXT DEFAULT 'feed',
  profile_used public.profile_level DEFAULT 'standard',
  provider_selected TEXT,
  provider_used TEXT,
  profile_visual_applied BOOLEAN DEFAULT false,
  profile_visual_ref TEXT,
  attempts INT DEFAULT 1,
  fallback_chain JSONB,
  folder TEXT DEFAULT 'exploration',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. ASSET VERSIONS
CREATE TABLE public.asset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  headline TEXT,
  body TEXT,
  cta TEXT,
  image_url TEXT,
  template_id TEXT,
  generation_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(asset_id, version)
);

-- 7. SPRINTS
CREATE TABLE public.sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status public.sprint_status NOT NULL DEFAULT 'active',
  output_mix public.output_type DEFAULT 'both',
  profile_level public.profile_level DEFAULT 'standard',
  budget_credits NUMERIC DEFAULT 0,
  spent_credits NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. SPRINT ITEMS
CREATE TABLE public.sprint_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id UUID NOT NULL REFERENCES public.sprints(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  status public.asset_status DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. LIBRARY FOLDERS
CREATE TABLE public.library_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_folder_id UUID REFERENCES public.library_folders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. COS CREDITS LOG
CREATE TABLE public.cos_credits_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  balance_after NUMERIC,
  description TEXT,
  related_entity_type TEXT,
  related_entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. PROVIDER CONFIGS
CREATE TABLE public.provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  provider_type public.provider_type NOT NULL,
  profile_level public.profile_level NOT NULL DEFAULT 'standard',
  model_name TEXT,
  is_active BOOLEAN DEFAULT true,
  fallback_order INT DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION public.is_project_owner(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects WHERE id = p_project_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_asset_owner(p_asset_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assets WHERE id = p_asset_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_sprint_owner(p_sprint_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sprints WHERE id = p_sprint_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_project_dna_updated_at BEFORE UPDATE ON public.project_dna FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sprints_updated_at BEFORE UPDATE ON public.sprints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_provider_configs_updated_at BEFORE UPDATE ON public.provider_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- RLS POLICIES
-- =============================================

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own projects" ON public.projects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Project DNA
ALTER TABLE public.project_dna ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own project dna" ON public.project_dna FOR ALL USING (public.is_project_owner(project_id)) WITH CHECK (public.is_project_owner(project_id));

-- Assets
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own assets" ON public.assets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Asset Versions
ALTER TABLE public.asset_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own asset versions" ON public.asset_versions FOR ALL USING (public.is_asset_owner(asset_id)) WITH CHECK (public.is_asset_owner(asset_id));

-- Sprints
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sprints" ON public.sprints FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Sprint Items
ALTER TABLE public.sprint_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sprint items" ON public.sprint_items FOR ALL USING (public.is_sprint_owner(sprint_id)) WITH CHECK (public.is_sprint_owner(sprint_id));

-- Library Folders
ALTER TABLE public.library_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own folders" ON public.library_folders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- COS Credits Log
ALTER TABLE public.cos_credits_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own credits" ON public.cos_credits_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System inserts credits" ON public.cos_credits_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Provider Configs
ALTER TABLE public.provider_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own providers" ON public.provider_configs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
