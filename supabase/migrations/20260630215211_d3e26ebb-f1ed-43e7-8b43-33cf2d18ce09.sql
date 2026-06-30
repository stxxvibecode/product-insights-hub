CREATE OR REPLACE FUNCTION public.test_check(sid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = sid AND s.status = 'live'::survey_status); $$;
GRANT EXECUTE ON FUNCTION public.test_check(uuid) TO anon, authenticated;
ALTER FUNCTION public.whoami() SET search_path = public;