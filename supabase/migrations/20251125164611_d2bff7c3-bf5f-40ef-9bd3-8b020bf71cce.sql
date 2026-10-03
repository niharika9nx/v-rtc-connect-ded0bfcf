-- Allow users to delete their own passes
CREATE POLICY "Users can delete own passes"
ON public.passes
FOR DELETE
USING (auth.uid() = user_id);

-- Create function to check for duplicate pass IDs and mark as fake
CREATE OR REPLACE FUNCTION public.check_duplicate_pass_ids()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if there are any other passes with the same pass ID
  IF NEW.buss_pass_id IS NOT NULL THEN
    -- Count passes with this pass ID (excluding the current one if it's an update)
    IF EXISTS (
      SELECT 1 
      FROM public.passes 
      WHERE buss_pass_id = NEW.buss_pass_id 
      AND id != NEW.id
      AND buss_pass_id IS NOT NULL
    ) THEN
      -- Mark the new/updated pass as unverified (fake)
      NEW.verified = false;
      
      -- Also mark all other passes with this ID as unverified
      UPDATE public.passes
      SET verified = false
      WHERE buss_pass_id = NEW.buss_pass_id
      AND id != NEW.id;
      
      -- Create alert for admin about duplicate
      INSERT INTO public.alerts (user_id, type, message, status)
      SELECT 
        user_id,
        'duplicate_pass',
        'Duplicate pass ID detected: ' || NEW.buss_pass_id || '. Pass marked as fake.',
        'unread'
      FROM public.passes
      WHERE buss_pass_id = NEW.buss_pass_id;
      
    ELSE
      -- If no duplicates, ensure this pass is verified
      NEW.verified = true;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to run the duplicate check function
DROP TRIGGER IF EXISTS check_duplicate_pass_ids_trigger ON public.passes;
CREATE TRIGGER check_duplicate_pass_ids_trigger
BEFORE INSERT OR UPDATE OF buss_pass_id ON public.passes
FOR EACH ROW
EXECUTE FUNCTION public.check_duplicate_pass_ids();