-- Create storage bucket for voice recordings
INSERT INTO storage.buckets (id, name, public) 
VALUES ('voice-samples', 'voice-samples', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for voice samples
CREATE POLICY "Users can upload their own voice samples"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'voice-samples' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own voice samples"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'voice-samples' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own voice samples"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'voice-samples' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add voice_sample_url to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS voice_sample_url TEXT;