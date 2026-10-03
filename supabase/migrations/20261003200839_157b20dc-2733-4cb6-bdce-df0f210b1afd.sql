-- Rate limiting for edge functions (e.g. enhance-pass AI gateway abuse prevention)
CREATE TABLE IF NOT EXISTS public.function_rate_limits (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    function_name TEXT NOT NULL,
    calls INT NOT NULL DEFAULT 0,
    window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, function_name)
);

ALTER TABLE public.function_rate_limits ENABLE ROW LEVEL SECURITY;
