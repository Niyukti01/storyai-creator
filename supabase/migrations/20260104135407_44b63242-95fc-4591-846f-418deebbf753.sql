-- Create video chapters table
CREATE TABLE public.video_chapters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  video_version_id UUID REFERENCES public.video_versions(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  start_seconds NUMERIC NOT NULL DEFAULT 0,
  end_seconds NUMERIC,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.video_chapters ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view chapters on own projects"
ON public.video_chapters
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = video_chapters.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can create chapters on own projects"
ON public.video_chapters
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = video_chapters.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can update chapters on own projects"
ON public.video_chapters
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = video_chapters.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can delete chapters on own projects"
ON public.video_chapters
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = video_chapters.project_id
  AND projects.user_id = auth.uid()
));

-- Indexes
CREATE INDEX idx_video_chapters_project ON public.video_chapters(project_id);
CREATE INDEX idx_video_chapters_start ON public.video_chapters(start_seconds);