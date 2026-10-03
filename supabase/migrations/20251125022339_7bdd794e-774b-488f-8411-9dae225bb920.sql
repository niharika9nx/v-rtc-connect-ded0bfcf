-- Remove redundant admin SELECT policy on bus_details
-- "Anyone can view bus details" already covers authenticated admins
DROP POLICY IF EXISTS "Admins can select all bus details" ON public.bus_details;