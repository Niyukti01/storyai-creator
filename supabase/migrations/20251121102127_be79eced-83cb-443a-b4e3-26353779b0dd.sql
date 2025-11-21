-- Add music_track column to store selected background music
ALTER TABLE projects ADD COLUMN IF NOT EXISTS music_track JSONB;

-- Add comment for clarity
COMMENT ON COLUMN projects.music_track IS 'Stores selected background music with track info: {id, name, category, mood, url}';