-- Add avatar column to projects table to store customization data
ALTER TABLE public.projects
ADD COLUMN avatar JSONB DEFAULT NULL;