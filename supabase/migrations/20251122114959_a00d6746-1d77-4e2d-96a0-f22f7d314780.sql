-- Add seat_number column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS seat_number TEXT;