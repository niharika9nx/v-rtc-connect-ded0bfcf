-- Add RLS policies to allow users to manage their own alerts

-- Allow users to update their own alerts (for dismissing and responding)
CREATE POLICY "Users can update own alerts"
ON public.alerts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own alerts
CREATE POLICY "Users can delete own alerts"
ON public.alerts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to insert their own alerts (for testing purposes)
CREATE POLICY "Users can insert own alerts"
ON public.alerts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);