CREATE TABLE public.project_share_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, recipient_email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_share_recipients TO authenticated;
GRANT ALL ON public.project_share_recipients TO service_role;

ALTER TABLE public.project_share_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage share recipients"
  ON public.project_share_recipients
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()));

CREATE INDEX project_share_recipients_project_idx ON public.project_share_recipients(project_id);

CREATE TRIGGER update_project_share_recipients_updated_at
  BEFORE UPDATE ON public.project_share_recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();