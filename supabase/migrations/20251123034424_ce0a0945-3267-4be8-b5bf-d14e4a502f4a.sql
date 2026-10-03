-- Allow admins to delete announcements
CREATE POLICY "Admins can delete announcements"
ON public.announcements
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow users to delete their own complaints
CREATE POLICY "Users can delete own complaints"
ON public.complaints
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);