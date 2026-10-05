-- Add expires_at column to announcements for admin-controlled expiry
ALTER TABLE public.announcements
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Recreate public_announcements view to expose expires_at
CREATE OR REPLACE VIEW public.public_announcements AS
SELECT id, message, created_at, expires_at
FROM public.announcements
ORDER BY created_at DESC;

ALTER VIEW public.public_announcements SET (security_invoker = on);
GRANT SELECT ON public.public_announcements TO authenticated;
GRANT SELECT ON public.public_announcements TO anon;
