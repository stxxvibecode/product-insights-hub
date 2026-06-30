DROP POLICY IF EXISTS responses_public_insert ON public.responses;
CREATE POLICY responses_public_insert ON public.responses FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = responses.survey_id AND s.status = 'live'::survey_status));
DROP FUNCTION IF EXISTS public.whoami();
DROP FUNCTION IF EXISTS public.test_check(uuid);