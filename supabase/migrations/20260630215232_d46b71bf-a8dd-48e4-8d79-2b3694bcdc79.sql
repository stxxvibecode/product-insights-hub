DROP POLICY IF EXISTS responses_public_insert ON public.responses;
CREATE POLICY responses_public_insert ON public.responses FOR INSERT TO anon WITH CHECK (true);