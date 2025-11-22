-- Create route storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('route', 'route', true)
ON CONFLICT (id) DO UPDATE
SET public = true;