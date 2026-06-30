CREATE OR REPLACE FUNCTION public.submit_public_answer(
  _response_id uuid,
  _question_id uuid,
  _respondent_token text,
  _value jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _response_survey_id uuid;
BEGIN
  SELECT r.survey_id
    INTO _response_survey_id
    FROM public.responses r
    JOIN public.surveys s ON s.id = r.survey_id
   WHERE r.id = _response_id
     AND r.respondent_token = _respondent_token
     AND s.status = 'live';

  IF _response_survey_id IS NULL THEN
    RAISE EXCEPTION 'Response not found or survey is not live' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.questions q
     WHERE q.id = _question_id
       AND q.survey_id = _response_survey_id
  ) THEN
    RAISE EXCEPTION 'Question does not belong to this response survey' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.answers (response_id, question_id, value)
  VALUES (_response_id, _question_id, COALESCE(_value, 'null'::jsonb))
  ON CONFLICT (response_id, question_id)
  DO UPDATE SET value = EXCLUDED.value;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_answer(uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_answer(uuid, uuid, text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_public_answer(uuid, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_answer(uuid, uuid, text, jsonb) TO service_role;