ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS insight_kind TEXT,
  ADD COLUMN IF NOT EXISTS product_area TEXT,
  ADD COLUMN IF NOT EXISTS priority_signal TEXT;

ALTER TABLE public.surveys
  ADD COLUMN IF NOT EXISTS brand_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;