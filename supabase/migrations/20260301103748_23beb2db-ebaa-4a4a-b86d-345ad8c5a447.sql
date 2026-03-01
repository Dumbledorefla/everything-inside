
-- Add workspace folder, pinning, and performance rating to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS workspace_folder text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS performance_rating numeric DEFAULT NULL;

-- Add rating and parent_id to assets for variations and feedback
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS rating integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parent_asset_id uuid DEFAULT NULL;

-- Add constraint for rating range via trigger
CREATE OR REPLACE FUNCTION public.validate_asset_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.rating IS NOT NULL AND (NEW.rating < 1 OR NEW.rating > 5) THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_asset_rating
  BEFORE INSERT OR UPDATE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_asset_rating();

-- Index for workspace folder filtering
CREATE INDEX IF NOT EXISTS idx_projects_workspace_folder ON public.projects (workspace_folder);
CREATE INDEX IF NOT EXISTS idx_projects_is_pinned ON public.projects (is_pinned);
CREATE INDEX IF NOT EXISTS idx_assets_parent_asset_id ON public.assets (parent_asset_id);
CREATE INDEX IF NOT EXISTS idx_assets_rating ON public.assets (rating);
