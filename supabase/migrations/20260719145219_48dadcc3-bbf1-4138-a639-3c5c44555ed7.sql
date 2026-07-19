
-- 1) Lock down SECURITY DEFINER functions from being called via API roles.
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 2) Remove overly-broad SELECT policy on storage.objects that allows listing
-- the public generated-videos bucket. Files remain reachable via their public
-- CDN URLs; only the listing/enumeration capability is removed.
DROP POLICY IF EXISTS "Public read access for videos" ON storage.objects;

-- 3) Drop the anonymous share_enabled-only policy on video_chapters. Shared
-- viewers already read chapter data through the shared_projects view, so this
-- unscoped policy is unused and leaks video_version_id linkage.
DROP POLICY IF EXISTS "Anyone can view chapters of shared projects" ON public.video_chapters;
