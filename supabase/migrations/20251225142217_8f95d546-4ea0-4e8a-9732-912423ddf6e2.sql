-- Create table for video versions/history
CREATE TABLE public.video_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  version_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'completed',
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB
);

-- Enable RLS
ALTER TABLE public.video_versions ENABLE ROW LEVEL SECURITY;

-- Users can view video versions of their own projects
CREATE POLICY "Users can view own project video versions"
ON public.video_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = video_versions.project_id 
    AND projects.user_id = auth.uid()
  )
);

-- Users can insert video versions for their own projects
CREATE POLICY "Users can insert video versions for own projects"
ON public.video_versions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = video_versions.project_id 
    AND projects.user_id = auth.uid()
  )
);

-- Users can delete video versions of their own projects
CREATE POLICY "Users can delete own project video versions"
ON public.video_versions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = video_versions.project_id 
    AND projects.user_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_video_versions_project_id ON public.video_versions(project_id);
CREATE INDEX idx_video_versions_created_at ON public.video_versions(created_at DESC);