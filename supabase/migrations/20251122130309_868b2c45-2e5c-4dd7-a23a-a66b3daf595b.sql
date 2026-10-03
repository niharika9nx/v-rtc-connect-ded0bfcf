-- CRITICAL SECURITY FIX: Explicitly deny anonymous access to sensitive tables

-- Deny anonymous access to profiles (contains emails, phone numbers, personal info)
CREATE POLICY "Deny anonymous access to profiles" 
ON public.profiles 
FOR SELECT 
TO anon 
USING (false);

-- Deny anonymous access to passes (contains identity card URLs and documents)
CREATE POLICY "Deny anonymous access to passes" 
ON public.passes 
FOR SELECT 
TO anon 
USING (false);

-- Deny anonymous access to fee_history (contains financial records)
CREATE POLICY "Deny anonymous access to fee_history" 
ON public.fee_history 
FOR SELECT 
TO anon 
USING (false);

-- Deny anonymous access to user_roles (contains authorization info)
CREATE POLICY "Deny anonymous access to user_roles" 
ON public.user_roles 
FOR SELECT 
TO anon 
USING (false);

-- Deny anonymous access to alerts (contains private notifications)
CREATE POLICY "Deny anonymous access to alerts" 
ON public.alerts 
FOR SELECT 
TO anon 
USING (false);

-- Deny anonymous access to complaints (contains private grievances)
CREATE POLICY "Deny anonymous access to complaints" 
ON public.complaints 
FOR SELECT 
TO anon 
USING (false);