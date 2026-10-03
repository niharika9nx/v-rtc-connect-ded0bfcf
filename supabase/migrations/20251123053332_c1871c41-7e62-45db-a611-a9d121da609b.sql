-- Add foreign key from passes to profiles
ALTER TABLE public.passes
ADD CONSTRAINT passes_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add unique constraint to fee_history for upserts
ALTER TABLE public.fee_history
ADD CONSTRAINT fee_history_user_month_year_unique 
UNIQUE (user_id, month, year);