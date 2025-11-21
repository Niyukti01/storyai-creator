-- Add video_url column to projects table to store generated videos
ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Add video_status column to track video generation progress
ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_status TEXT DEFAULT 'pending';

-- Add video_generated_at column to track when video was created
ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_generated_at TIMESTAMP WITH TIME ZONE;