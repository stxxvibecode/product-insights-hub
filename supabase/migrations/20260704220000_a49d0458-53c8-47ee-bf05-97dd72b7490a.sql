-- Lock down public (anon) access to responses and answers.
--
-- Before this migration, the anon role had SELECT/INSERT/UPDATE on both
-- responses and answers, with policies keyed only on the parent survey's
-- status = 'live'. That let anyone:
--   * enumerate response IDs and read all submitted answers for any live
--     survey (PII leak), and
--   * UPDATE any response (set completed_at, etc.) by ID — an IDOR.
--
-- Public submission now flows through server functions using the service
-- role client (supabaseAdmin), which enforce app-level checks (survey is
-- live, respondent_token matches, question belongs to survey). RLS for
-- anon is no longer needed on these tables and is removed entirely.
-- Owner (authenticated) access is preserved: read+delete on responses,
-- read on answers. Unneeded authenticated INSERT/UPDATE policies (any
-- logged-in user could write to any live survey) are also dropped.

-- --- responses ---
DROP POLICY IF EXISTS "responses_public_insert" ON public.responses;
DROP POLICY IF EXISTS "responses_public_update" ON public.responses;
DROP POLICY IF EXISTS "responses_public_select" ON public.responses;
DROP POLICY IF EXISTS "responses_auth_insert" ON public.responses;
DROP POLICY IF EXISTS "responses_auth_update" ON public.responses;
-- Kept: responses_owner_select, responses_owner_delete

REVOKE SELECT, INSERT, UPDATE ON public.responses FROM anon;
REVOKE INSERT, UPDATE ON public.responses FROM authenticated;
-- authenticated keeps SELECT + DELETE (owner read/delete); service_role ALL.

-- --- answers ---
DROP POLICY IF EXISTS "answers_public_insert" ON public.answers;
DROP POLICY IF EXISTS "answers_public_update" ON public.answers;
DROP POLICY IF EXISTS "answers_auth_insert" ON public.answers;
DROP POLICY IF EXISTS "answers_auth_update" ON public.answers;
-- Kept: answers_owner_select

REVOKE SELECT, INSERT, UPDATE ON public.answers FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.answers FROM authenticated;
-- authenticated keeps SELECT (owner read); service_role ALL.
