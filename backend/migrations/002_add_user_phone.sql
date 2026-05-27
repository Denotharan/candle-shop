ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_key
ON public.users (phone);
