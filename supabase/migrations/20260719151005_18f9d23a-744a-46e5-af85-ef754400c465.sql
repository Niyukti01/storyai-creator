
CREATE OR REPLACE FUNCTION public.get_shared_video_chapters(_share_token text)
RETURNS TABLE (
  id uuid,
  project_id uuid,
  video_version_id uuid,
  scene_number integer,
  title text,
  start_seconds numeric,
  end_seconds numeric,
  thumbnail_url text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.project_id, c.video_version_id, c.scene_number, c.title,
         c.start_seconds, c.end_seconds, c.thumbnail_url, c.created_at
  FROM public.video_chapters c
  JOIN public.projects p ON p.id = c.project_id
  WHERE p.share_enabled = true
    AND p.share_token IS NOT NULL
    AND _share_token IS NOT NULL
    AND p.share_token = _share_token;
$$;

CREATE OR REPLACE FUNCTION public.get_shared_video_versions(_share_token text)
RETURNS TABLE (
  id uuid,
  project_id uuid,
  version_number integer,
  video_url text,
  thumbnail_url text,
  status text,
  duration_seconds integer,
  file_size_bytes bigint,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, v.project_id, v.version_number, v.video_url, v.thumbnail_url,
         v.status, v.duration_seconds, v.file_size_bytes, v.metadata, v.created_at
  FROM public.video_versions v
  JOIN public.projects p ON p.id = v.project_id
  WHERE p.share_enabled = true
    AND p.share_token IS NOT NULL
    AND _share_token IS NOT NULL
    AND p.share_token = _share_token;
$$;

REVOKE ALL ON FUNCTION public.get_shared_video_chapters(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_shared_video_versions(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_video_chapters(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_video_versions(text) TO anon, authenticated;
