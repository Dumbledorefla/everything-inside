
-- Add main influencer reference to projects
ALTER TABLE public.projects 
ADD COLUMN main_influencer_asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL;

-- Add persona_type to assets for categorizing persona-related assets
ALTER TABLE public.assets 
ADD COLUMN persona_type text;

-- Add reference_asset_id to track which base persona a variation comes from
ALTER TABLE public.assets 
ADD COLUMN reference_asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL;
