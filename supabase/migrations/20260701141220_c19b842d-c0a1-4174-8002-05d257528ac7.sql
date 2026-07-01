
-- Versioning fields on surveys
ALTER TABLE public.surveys
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_survey_id uuid NULL REFERENCES public.surveys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_edit_draft boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS surveys_parent_idx ON public.surveys(parent_survey_id);

-- Track question lineage for diffing between draft and live
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS origin_question_id uuid NULL;

-- Stamp responses with the survey version at submission time
ALTER TABLE public.responses
  ADD COLUMN IF NOT EXISTS survey_version int NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS responses_survey_version_idx ON public.responses(survey_id, survey_version);

-- Historical snapshots of published survey versions
CREATE TABLE IF NOT EXISTS public.survey_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  version int NOT NULL,
  title text NOT NULL,
  description text,
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  welcome_screen jsonb NOT NULL DEFAULT '{}'::jsonb,
  thank_you_screen jsonb NOT NULL DEFAULT '{}'::jsonb,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (survey_id, version)
);

GRANT SELECT ON public.survey_versions TO authenticated;
GRANT ALL ON public.survey_versions TO service_role;

ALTER TABLE public.survey_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "survey_versions_owner_read"
  ON public.survey_versions FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_versions.survey_id AND s.owner_id = auth.uid()));

-- Public respondents should NEVER see edit drafts. Tighten public policies
-- to explicitly exclude is_edit_draft rows.
DROP POLICY IF EXISTS "surveys_public_live_read" ON public.surveys;
CREATE POLICY "surveys_public_live_read"
  ON public.surveys FOR SELECT
  TO anon
  USING (status = 'live'::survey_status AND is_edit_draft = false);

DROP POLICY IF EXISTS "surveys_auth_live_read" ON public.surveys;
CREATE POLICY "surveys_auth_live_read"
  ON public.surveys FOR SELECT
  TO authenticated
  USING (status = 'live'::survey_status AND is_edit_draft = false);
