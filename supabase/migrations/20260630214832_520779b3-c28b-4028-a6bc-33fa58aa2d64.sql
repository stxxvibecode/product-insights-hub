
-- Public respondent flow
GRANT SELECT ON public.surveys TO anon;
GRANT SELECT ON public.questions TO anon;
GRANT SELECT ON public.question_tags TO anon;
GRANT SELECT ON public.tags TO anon;
GRANT INSERT, UPDATE, SELECT ON public.responses TO anon;
GRANT INSERT, UPDATE, SELECT ON public.answers TO anon;

-- Authenticated owners
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surveys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.answers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_chat_messages TO authenticated;

-- Service role full access
GRANT ALL ON public.surveys TO service_role;
GRANT ALL ON public.questions TO service_role;
GRANT ALL ON public.question_tags TO service_role;
GRANT ALL ON public.tags TO service_role;
GRANT ALL ON public.responses TO service_role;
GRANT ALL ON public.answers TO service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.decision_notes TO service_role;
GRANT ALL ON public.survey_chat_messages TO service_role;
