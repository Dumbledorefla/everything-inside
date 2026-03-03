
-- Add video_url column to asset_versions
ALTER TABLE public.asset_versions ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Add 'video' to the output_type enum
ALTER TYPE public.output_type ADD VALUE IF NOT EXISTS 'video';
