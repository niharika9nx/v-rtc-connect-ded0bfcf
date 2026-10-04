-- Atomic rate limiting for edge functions.
-- The previous read-then-upsert approach in enhance-pass allowed concurrent
-- requests to exceed the limit. This SECURITY DEFINER function performs the
-- check and increment in a single statement, which serializes concurrent calls
-- on the row lock. It is granted only to service_role so that clients cannot
-- call it directly or supply their own _max_calls.
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  _user_id UUID,
  _function_name TEXT,
  _max_calls INT,
  _window_seconds INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _calls INT;
BEGIN
  INSERT INTO public.function_rate_limits (user_id, function_name, calls, window_start)
  VALUES (_user_id, _function_name, 1, now())
  ON CONFLICT (user_id, function_name) DO UPDATE
    SET calls = CASE
          WHEN public.function_rate_limits.window_start <= now() - make_interval(secs => _window_seconds)
            THEN 1
          ELSE public.function_rate_limits.calls + 1
        END,
        window_start = CASE
          WHEN public.function_rate_limits.window_start <= now() - make_interval(secs => _window_seconds)
            THEN now()
          ELSE public.function_rate_limits.window_start
        END
  RETURNING calls INTO _calls;

  RETURN _calls <= _max_calls;
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(UUID, TEXT, INT, INT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(UUID, TEXT, INT, INT)
  TO service_role;
