-- Create video annotations table
CREATE TABLE public.video_annotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  video_version_id UUID REFERENCES public.video_versions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  timestamp_seconds NUMERIC NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.video_annotations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view annotations on own projects"
ON public.video_annotations
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = video_annotations.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can create annotations on own projects"
ON public.video_annotations
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = video_annotations.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own annotations"
ON public.video_annotations
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own annotations"
ON public.video_annotations
FOR DELETE
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_video_annotations_project ON public.video_annotations(project_id);
CREATE INDEX idx_video_annotations_timestamp ON public.video_annotations(timestamp_seconds);

-- Updated at trigger
CREATE TRIGGER update_video_annotations_updated_at
BEFORE UPDATE ON public.video_annotations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();