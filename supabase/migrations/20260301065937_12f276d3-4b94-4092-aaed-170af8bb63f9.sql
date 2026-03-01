-- Detailed telemetry/ledger for all AI operations
CREATE TABLE public.cos_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  provider_used TEXT NOT NULL,
  operation_type TEXT NOT NULL, -- IMAGE_GEN, TEXT_GEN, SPRINT, MEMORY_ANALYSIS, PAGE_ASSEMBLY, CHAT
  credits_cost NUMERIC NOT NULL DEFAULT 0,
  estimated_usd NUMERIC NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cos_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own ledger" ON public.cos_ledger
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System inserts ledger" ON public.cos_ledger
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_cos_ledger_project ON public.cos_ledger(project_id);
CREATE INDEX idx_cos_ledger_created ON public.cos_ledger(created_at);

-- Add official_count tracking for auto-trigger memory analysis
ALTER TABLE public.project_memory ADD COLUMN IF NOT EXISTS last_analysis_at TIMESTAMP WITH TIME ZONE;
