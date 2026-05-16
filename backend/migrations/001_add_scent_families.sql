CREATE TABLE IF NOT EXISTS public.scent_families (
    name TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.scent_families (name)
SELECT DISTINCT scent_family
FROM public.products
WHERE scent_family IS NOT NULL AND scent_family <> ''
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.scent_families DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    ALTER TABLE public.products
    ADD CONSTRAINT products_scent_family_fkey
    FOREIGN KEY (scent_family) REFERENCES public.scent_families(name);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
