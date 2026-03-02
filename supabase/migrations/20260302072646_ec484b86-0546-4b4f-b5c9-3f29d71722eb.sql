
-- Create a safe view for shared projects that excludes user_id and internal fields
CREATE VIEW public.shared_projects
WITH (security_invoker = on) AS
  SELECT 
    id,
    title,
    description,
    genre,
    script,
    video_url,
    share_token,
    share_enabled,
    created_at,
    updated_at
  FROM public.projects
  WHERE share_enabled = true AND share_token IS NOT NULL;
