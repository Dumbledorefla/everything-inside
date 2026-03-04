
-- Create videos table
CREATE TABLE public.videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  video_type TEXT NOT NULL DEFAULT 'freeform',
  source_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  prompt TEXT,
  duration TEXT,
  aspect_ratio TEXT DEFAULT '16:9',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users manage own videos"
ON public.videos
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
