
-- Add dna_version_id to assets so every generated asset snapshots which DNA version was used
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS dna_version_id uuid REFERENCES public.project_dna(id);

-- Add folder column default to 'Exploração' (already exists but ensure default)
-- Already exists, just ensure the default is correct
ALTER TABLE public.assets ALTER COLUMN folder SET DEFAULT 'Exploração';
