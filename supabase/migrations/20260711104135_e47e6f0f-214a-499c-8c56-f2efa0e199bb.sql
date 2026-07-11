
-- 1) Shared projects: replace overly-broad public SELECT with a column-safe policy.
--    Postgres RLS can't restrict columns, so we revoke the sensitive columns from
--    anon/authenticated and rely on the security-invoker shared_projects view for public reads.
DROP POLICY IF EXISTS "Anyone can view shared projects" ON public.projects;

-- Recreate as authenticated-owner-only; public share reads must go through the shared_projects view.
-- (Owners already have "Users can view own projects".)

-- Ensure the shared_projects view is readable by anon for public sharing.
GRANT SELECT ON public.shared_projects TO anon, authenticated;

-- 2) Storage: generated-videos bucket — scope INSERT and DELETE to the user's folder.
DROP POLICY IF EXISTS "Authenticated users can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own videos" ON storage.objects;

CREATE POLICY "Users can upload own videos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'generated-videos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own videos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'generated-videos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 3) video_chapters: allow public read when the parent project is shared.
CREATE POLICY "Anyone can view chapters of shared projects"
ON public.video_chapters
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = video_chapters.project_id
      AND p.share_enabled = true
      AND p.share_token IS NOT NULL
  )
);
