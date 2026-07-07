-- Workspace brand profiles + form-level brand overrides + question insight metadata.
--
-- Brand inheritance model:
--   1. Form-level overrides (surveys.brand_overrides) win.
--   2. Otherwise the workspace brand profile applies.
--   3. Otherwise Insightform defaults apply (resolved in app code).
-- Resolution happens at read time (app uses the authed client; the public
-- form route resolves through the service role), so preview and published
-- forms always render from the same resolved brand.

CREATE TABLE IF NOT EXISTS public.workspace_brand_profiles (
  workspace_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name text NOT NULL DEFAULT '',
  product_description text NOT NULL DEFAULT '',
  logo_url text,
  primary_color text NOT NULL DEFAULT '#FF7A45',
  background_color text NOT NULL DEFAULT '#0D0F14',
  text_color text NOT NULL DEFAULT '#F2F2F0',
  accent_color text NOT NULL DEFAULT '#FF7A45',
  font_style text NOT NULL DEFAULT 'modern',
  button_style text NOT NULL DEFAULT 'rounded',
  form_layout text NOT NULL DEFAULT 'one_question_at_a_time',
  tone text NOT NULL DEFAULT 'professional',
  default_thank_you_message text NOT NULL DEFAULT 'Thanks for your feedback. Your input helps us improve the product.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_brand_profiles TO authenticated;
GRANT ALL ON public.workspace_brand_profiles TO service_role;
REVOKE ALL ON public.workspace_brand_profiles FROM anon;

ALTER TABLE public.workspace_brand_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_brand_profiles_owner_all" ON public.workspace_brand_profiles;
CREATE POLICY "workspace_brand_profiles_owner_all" ON public.workspace_brand_profiles
  FOR ALL TO authenticated
  USING (auth.uid() = workspace_id)
  WITH CHECK (auth.uid() = workspace_id);

DROP TRIGGER IF EXISTS trg_workspace_brand_profiles_updated ON public.workspace_brand_profiles;
CREATE TRIGGER trg_workspace_brand_profiles_updated
  BEFORE UPDATE ON public.workspace_brand_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Form-level brand overrides. Empty object = fully inherit workspace brand.
ALTER TABLE public.surveys
  ADD COLUMN IF NOT EXISTS brand_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Question insight metadata for the insights dashboard.
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS insight_kind text,
  ADD COLUMN IF NOT EXISTS product_area text,
  ADD COLUMN IF NOT EXISTS priority_signal text;
