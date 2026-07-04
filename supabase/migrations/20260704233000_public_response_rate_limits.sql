-- Rate limit public survey response writes by survey + respondent token.
-- Public clients cannot access this table/function directly; server functions
-- call it through the service role before creating responses or answers.

ALTER TABLE public.responses
  ADD COLUMN IF NOT EXISTS ip_address inet;

CREATE INDEX IF NOT EXISTS responses_survey_token_started_idx
  ON public.responses (survey_id, respondent_token, started_at DESC);

CREATE TABLE IF NOT EXISTS public.public_response_rate_limits (
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  respondent_token text NOT NULL,
  window_start timestamptz NOT NULL,
  write_count integer NOT NULL DEFAULT 0,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text,
  PRIMARY KEY (survey_id, respondent_token, window_start)
);

CREATE INDEX IF NOT EXISTS public_response_rate_limits_last_seen_idx
  ON public.public_response_rate_limits (last_seen_at DESC);

GRANT ALL ON public.public_response_rate_limits TO service_role;
REVOKE ALL ON public.public_response_rate_limits FROM anon, authenticated;

ALTER TABLE public.public_response_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_public_response_write(
  _survey_id uuid,
  _respondent_token text,
  _ip_address inet DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _limit integer DEFAULT 120,
  _window_seconds integer DEFAULT 900
)
RETURNS TABLE(allowed boolean, write_count integer, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window_start timestamptz;
  _count integer;
BEGIN
  IF _limit < 1 THEN
    RAISE EXCEPTION 'Rate limit must be positive';
  END IF;

  IF _window_seconds < 60 THEN
    RAISE EXCEPTION 'Rate limit window must be at least 60 seconds';
  END IF;

  _window_start := to_timestamp(floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds);

  INSERT INTO public.public_response_rate_limits (
    survey_id,
    respondent_token,
    window_start,
    write_count,
    ip_address,
    user_agent
  )
  VALUES (
    _survey_id,
    _respondent_token,
    _window_start,
    1,
    _ip_address,
    left(_user_agent, 500)
  )
  ON CONFLICT (survey_id, respondent_token, window_start)
  DO UPDATE SET
    write_count = public.public_response_rate_limits.write_count + 1,
    last_seen_at = now(),
    ip_address = COALESCE(EXCLUDED.ip_address, public.public_response_rate_limits.ip_address),
    user_agent = COALESCE(EXCLUDED.user_agent, public.public_response_rate_limits.user_agent)
  RETURNING public.public_response_rate_limits.write_count INTO _count;

  RETURN QUERY SELECT
    _count <= _limit,
    _count,
    _window_start + make_interval(secs => _window_seconds);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_public_response_write(uuid, text, inet, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_public_response_write(uuid, text, inet, text, integer, integer) TO service_role;
