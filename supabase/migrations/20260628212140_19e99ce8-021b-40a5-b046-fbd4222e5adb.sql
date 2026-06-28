
-- =========================================================================
-- ENUMS
-- =========================================================================
CREATE TYPE public.survey_status AS ENUM ('draft', 'live', 'closed');
CREATE TYPE public.question_type AS ENUM (
  'short_text','long_text','email','number',
  'single_choice','multi_choice','rating','nps','scale','yes_no'
);

-- =========================================================================
-- UTIL: updated_at trigger
-- =========================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========================================================================
-- PROFILES
-- =========================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- SURVEYS
-- =========================================================================
CREATE TABLE public.surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Untitled survey',
  description TEXT,
  status public.survey_status NOT NULL DEFAULT 'draft',
  theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  welcome_screen JSONB NOT NULL DEFAULT '{"title":"","description":"","button":"Start"}'::jsonb,
  thank_you_screen JSONB NOT NULL DEFAULT '{"title":"Thanks!","description":"Your response was recorded."}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX surveys_owner_idx ON public.surveys(owner_id);
CREATE INDEX surveys_status_idx ON public.surveys(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surveys TO authenticated;
GRANT SELECT ON public.surveys TO anon;
GRANT ALL ON public.surveys TO service_role;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "surveys_owner_all" ON public.surveys FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "surveys_public_live_read" ON public.surveys FOR SELECT TO anon USING (status = 'live');
CREATE POLICY "surveys_auth_live_read" ON public.surveys FOR SELECT TO authenticated USING (status = 'live');
CREATE TRIGGER trg_surveys_updated BEFORE UPDATE ON public.surveys FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- QUESTIONS
-- =========================================================================
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  type public.question_type NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT,
  required BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX questions_survey_idx ON public.questions(survey_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT SELECT ON public.questions TO anon;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions_owner_all" ON public.questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.owner_id = auth.uid()));
CREATE POLICY "questions_public_live_read" ON public.questions FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.status = 'live'));
CREATE POLICY "questions_auth_live_read" ON public.questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.status = 'live'));
CREATE TRIGGER trg_questions_updated BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- TAGS
-- =========================================================================
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated;
GRANT ALL ON public.tags TO service_role;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags_owner_all" ON public.tags FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.question_tags (
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, tag_id)
);
GRANT SELECT, INSERT, DELETE ON public.question_tags TO authenticated;
GRANT ALL ON public.question_tags TO service_role;
ALTER TABLE public.question_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "question_tags_owner_all" ON public.question_tags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tags t WHERE t.id = tag_id AND t.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tags t WHERE t.id = tag_id AND t.owner_id = auth.uid()));

-- =========================================================================
-- RESPONSES
-- =========================================================================
CREATE TABLE public.responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  respondent_token TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  user_agent TEXT,
  referrer TEXT
);
CREATE INDEX responses_survey_idx ON public.responses(survey_id, started_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.responses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responses TO authenticated;
GRANT ALL ON public.responses TO service_role;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
-- Owner can read all responses for their surveys
CREATE POLICY "responses_owner_select" ON public.responses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.owner_id = auth.uid()));
CREATE POLICY "responses_owner_delete" ON public.responses FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.owner_id = auth.uid()));
-- Anyone can create a response for a live survey
CREATE POLICY "responses_public_insert" ON public.responses FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.status = 'live'));
CREATE POLICY "responses_auth_insert" ON public.responses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.status = 'live'));
-- Anyone can update (complete) a response for a live survey
CREATE POLICY "responses_public_update" ON public.responses FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.status = 'live'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.status = 'live'));
CREATE POLICY "responses_auth_update" ON public.responses FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.status = 'live'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.status = 'live'));

-- =========================================================================
-- ANSWERS
-- =========================================================================
CREATE TABLE public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES public.responses(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  value JSONB NOT NULL DEFAULT 'null'::jsonb,
  value_text TEXT GENERATED ALWAYS AS (
    CASE WHEN jsonb_typeof(value) = 'string' THEN value #>> '{}' ELSE NULL END
  ) STORED,
  value_number NUMERIC GENERATED ALWAYS AS (
    CASE WHEN jsonb_typeof(value) = 'number' THEN (value)::text::numeric ELSE NULL END
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (response_id, question_id)
);
CREATE INDEX answers_question_idx ON public.answers(question_id);
CREATE INDEX answers_response_idx ON public.answers(response_id);
GRANT SELECT, INSERT, UPDATE ON public.answers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.answers TO authenticated;
GRANT ALL ON public.answers TO service_role;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "answers_owner_select" ON public.answers FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.responses r JOIN public.surveys s ON s.id = r.survey_id
    WHERE r.id = response_id AND s.owner_id = auth.uid()
  ));
CREATE POLICY "answers_public_insert" ON public.answers FOR INSERT TO anon
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.responses r JOIN public.surveys s ON s.id = r.survey_id
    WHERE r.id = response_id AND s.status = 'live'
  ));
CREATE POLICY "answers_auth_insert" ON public.answers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.responses r JOIN public.surveys s ON s.id = r.survey_id
    WHERE r.id = response_id AND s.status = 'live'
  ));
CREATE POLICY "answers_public_update" ON public.answers FOR UPDATE TO anon
  USING (EXISTS (
    SELECT 1 FROM public.responses r JOIN public.surveys s ON s.id = r.survey_id
    WHERE r.id = response_id AND s.status = 'live'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.responses r JOIN public.surveys s ON s.id = r.survey_id
    WHERE r.id = response_id AND s.status = 'live'
  ));
CREATE POLICY "answers_auth_update" ON public.answers FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.responses r JOIN public.surveys s ON s.id = r.survey_id
    WHERE r.id = response_id AND s.status = 'live'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.responses r JOIN public.surveys s ON s.id = r.survey_id
    WHERE r.id = response_id AND s.status = 'live'
  ));

-- =========================================================================
-- DECISION NOTES
-- =========================================================================
CREATE TABLE public.decision_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX decision_notes_owner_idx ON public.decision_notes(owner_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_notes TO authenticated;
GRANT ALL ON public.decision_notes TO service_role;
ALTER TABLE public.decision_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "decision_notes_owner_all" ON public.decision_notes FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
