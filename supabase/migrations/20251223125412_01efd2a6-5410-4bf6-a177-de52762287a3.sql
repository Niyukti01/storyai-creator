-- Add sharing columns to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN DEFAULT false;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_projects_share_token ON public.projects(share_token) WHERE share_token IS NOT NULL;

-- Create policy to allow public read access for shared projects
CREATE POLICY "Anyone can view shared projects" 
ON public.projects 
FOR SELECT 
USING (share_enabled = true AND share_token IS NOT NULL);