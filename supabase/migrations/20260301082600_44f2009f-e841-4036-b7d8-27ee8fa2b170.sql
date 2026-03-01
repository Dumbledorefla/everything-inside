
-- Chat threads table (nullable project_id for global threads)
CREATE TABLE public.chat_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT,
  last_active TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Chat messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  audio_url TEXT,
  actions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_threads
CREATE POLICY "Users manage own threads"
ON public.chat_threads FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS policies for chat_messages (via thread ownership)
CREATE OR REPLACE FUNCTION public.is_thread_owner(p_thread_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_threads WHERE id = p_thread_id AND user_id = auth.uid()
  );
$$;

CREATE POLICY "Users manage own messages"
ON public.chat_messages FOR ALL
USING (is_thread_owner(thread_id))
WITH CHECK (is_thread_owner(thread_id));

-- Indexes for performance
CREATE INDEX idx_chat_threads_user_project ON public.chat_threads(user_id, project_id);
CREATE INDEX idx_chat_threads_last_active ON public.chat_threads(last_active DESC);
CREATE INDEX idx_chat_messages_thread ON public.chat_messages(thread_id, created_at);

-- Auto-update last_active on new message
CREATE OR REPLACE FUNCTION public.update_thread_last_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_threads SET last_active = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_thread_activity
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_thread_last_active();
