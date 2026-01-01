-- Fix 1: Make pass-documents bucket private
UPDATE storage.buckets SET public = false WHERE id = 'pass-documents';

-- Fix 2: Drop the public policy on profiles table that exposes all user data
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;