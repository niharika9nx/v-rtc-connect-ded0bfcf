-- Add RLS policies for passes table to allow users to manage their own passes
-- and admins to manage all passes

-- Allow users to insert their own passes
CREATE POLICY "Users can insert own passes" 
ON public.passes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own passes
CREATE POLICY "Users can update own passes" 
ON public.passes 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own passes
CREATE POLICY "Users can delete own passes" 
ON public.passes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Allow admins to insert any passes
CREATE POLICY "Admins can insert passes" 
ON public.passes 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any passes
CREATE POLICY "Admins can update passes" 
ON public.passes 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete any passes
CREATE POLICY "Admins can delete passes" 
ON public.passes 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'));

-- Add RLS policy for profiles to allow users to update their own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);