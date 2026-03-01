
-- Add reference_type column to reference_analyses
ALTER TABLE public.reference_analyses 
ADD COLUMN reference_type text NOT NULL DEFAULT 'instagram';

-- Add comment for documentation
COMMENT ON COLUMN public.reference_analyses.reference_type IS 'Type of reference: instagram, sales, landing, brand';
