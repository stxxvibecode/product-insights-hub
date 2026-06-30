CREATE INDEX IF NOT EXISTS surveys_owner_updated_idx ON public.surveys (owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS surveys_owner_status_updated_idx ON public.surveys (owner_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS responses_survey_id_idx ON public.responses (survey_id);