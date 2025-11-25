-- Add video generation progress tracking fields
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS video_progress INTEGER DEFAULT 0 CHECK (video_progress >= 0 AND video_progress <= 100),
ADD COLUMN IF NOT EXISTS video_generation_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS video_generation_cancelled BOOLEAN DEFAULT FALSE;