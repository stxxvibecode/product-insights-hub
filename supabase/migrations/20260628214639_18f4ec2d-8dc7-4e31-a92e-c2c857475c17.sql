
CREATE TABLE public.survey_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL DEFAULT '',
  tool_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX survey_chat_messages_survey_idx ON public.survey_chat_messages(survey_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_chat_messages TO authenticated;
GRANT ALL ON public.survey_chat_messages TO service_role;

ALTER TABLE public.survey_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read survey chat" ON public.survey_chat_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.owner_id = auth.uid()));

CREATE POLICY "Owners write survey chat" ON public.survey_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.owner_id = auth.uid()));

CREATE POLICY "Owners delete survey chat" ON public.survey_chat_messages
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.owner_id = auth.uid()));
