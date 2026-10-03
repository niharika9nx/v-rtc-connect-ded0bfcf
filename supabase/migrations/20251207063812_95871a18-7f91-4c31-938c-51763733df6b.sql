-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create bus_requests table for tracking bus assignment requests
CREATE TABLE public.bus_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('existing', 'new')),
  requested_bus_number TEXT,
  from_month TEXT,
  to_month TEXT,
  year INTEGER,
  college TEXT,
  study_year TEXT,
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  assigned_bus_number TEXT,
  assigned_seat_number INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bus_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own bus requests"
ON public.bus_requests
FOR SELECT
USING ((SELECT auth.uid()) = user_id);

-- Users can insert their own requests
CREATE POLICY "Users can create bus requests"
ON public.bus_requests
FOR INSERT
WITH CHECK ((SELECT auth.uid()) = user_id);

-- Users can delete their own pending requests
CREATE POLICY "Users can delete own pending requests"
ON public.bus_requests
FOR DELETE
USING ((SELECT auth.uid()) = user_id AND status = 'pending');

-- Admins can view all requests
CREATE POLICY "Admins can view all bus requests"
ON public.bus_requests
FOR SELECT
USING (public.has_role((SELECT auth.uid()), 'admin'::app_role));

-- Admins can update requests (assign bus/seat, change status)
CREATE POLICY "Admins can update bus requests"
ON public.bus_requests
FOR UPDATE
USING (public.has_role((SELECT auth.uid()), 'admin'::app_role))
WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::app_role));

-- Admins can delete requests
CREATE POLICY "Admins can delete bus requests"
ON public.bus_requests
FOR DELETE
USING (public.has_role((SELECT auth.uid()), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_bus_requests_user_id ON public.bus_requests(user_id);
CREATE INDEX idx_bus_requests_status ON public.bus_requests(status);
CREATE INDEX idx_bus_requests_requested_bus ON public.bus_requests(requested_bus_number);

-- Create trigger for updating updated_at
CREATE TRIGGER update_bus_requests_updated_at
BEFORE UPDATE ON public.bus_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();