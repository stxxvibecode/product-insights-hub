CREATE TABLE public.workspace_brand_profiles (
  workspace_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL DEFAULT 'Insightform',
  product_description TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#FF7A45',
  background_color TEXT NOT NULL DEFAULT '#0D0F14',
  text_color TEXT NOT NULL DEFAULT '#F2F2F0',
  accent_color TEXT NOT NULL DEFAULT '#FF7A45',
  font_style TEXT NOT NULL DEFAULT 'modern',
  button_style TEXT NOT NULL DEFAULT 'rounded',
  form_layout TEXT NOT NULL DEFAULT 'one_question_at_a_time',
  tone TEXT NOT NULL DEFAULT 'professional',
  default_thank_you_message TEXT NOT NULL DEFAULT 'Thanks for your feedback. Your input helps us improve the product.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_brand_profiles TO authenticated;
GRANT ALL ON public.workspace_brand_profiles TO service_role;

ALTER TABLE public.workspace_brand_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own brand profile"
  ON public.workspace_brand_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = workspace_id)
  WITH CHECK (auth.uid() = workspace_id);

CREATE TRIGGER set_workspace_brand_profiles_updated_at
  BEFORE UPDATE ON public.workspace_brand_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();