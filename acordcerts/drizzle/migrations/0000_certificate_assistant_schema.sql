CREATE TABLE public.acord_templates (
  form_code text PRIMARY KEY,
  file_path text NOT NULL,
  field_names jsonb NOT NULL DEFAULT '[]'::jsonb,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.acord_templates TO service_role;
ALTER TABLE public.acord_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.app_settings (
  id int PRIMARY KEY DEFAULT 1,
  signature_path text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.app_settings (id) VALUES (1);

CREATE TABLE public.saved_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  file_path text NOT NULL,
  mime_type text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.saved_documents TO service_role;
ALTER TABLE public.saved_documents ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_code text,
  insured text,
  holder text,
  pdf_path text,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;