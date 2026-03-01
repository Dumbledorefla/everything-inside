
-- Add operation_mode to projects table (persisted per project)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS operation_mode text NOT NULL DEFAULT 'social';

-- Add mode and format tags to assets for smart filtering
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS operation_mode text DEFAULT NULL;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS format_label text DEFAULT NULL;
