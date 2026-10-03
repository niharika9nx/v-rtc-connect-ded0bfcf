-- Move database extensions from public schema to dedicated extensions schema
-- This improves organization and prevents namespace pollution

-- 1. Create the extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- 2. Move existing extensions from public to extensions schema
-- Common extensions that might be installed:

-- Move uuid-ossp extension (for UUID generation)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp'
  ) THEN
    ALTER EXTENSION "uuid-ossp" SET SCHEMA extensions;
  END IF;
END $$;

-- Move pg_trgm extension (for text search) if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
  ) THEN
    ALTER EXTENSION "pg_trgm" SET SCHEMA extensions;
  END IF;
END $$;

-- Move pgcrypto extension (for encryption) if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
  ) THEN
    ALTER EXTENSION "pgcrypto" SET SCHEMA extensions;
  END IF;
END $$;

-- Move pg_stat_statements extension if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
  ) THEN
    ALTER EXTENSION "pg_stat_statements" SET SCHEMA extensions;
  END IF;
END $$;

-- Move pgjwt extension if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pgjwt'
  ) THEN
    ALTER EXTENSION "pgjwt" SET SCHEMA extensions;
  END IF;
END $$;

-- Move http extension if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'http'
  ) THEN
    ALTER EXTENSION "http" SET SCHEMA extensions;
  END IF;
END $$;

-- 3. Update search_path to include extensions schema
-- This ensures functions from extensions are still accessible
ALTER DATABASE postgres SET search_path TO public, extensions;

-- Grant usage on extensions schema to relevant roles
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

-- Note: After this migration, extension functions will still work
-- because the search_path includes the extensions schema