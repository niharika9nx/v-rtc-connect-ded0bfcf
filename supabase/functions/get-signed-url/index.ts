import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { extractBearerToken } from '../_shared/auth.ts';

// {userId}/{filename}.{jpg|jpeg|png} — same pattern enforced by enhance-pass
const FILE_PATH_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/]+\.(jpg|jpeg|png)$/i;

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  const cors = corsHeaders(req.headers.get('origin'));

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  try {
    const token = extractBearerToken(req);
    if (!token) {
      return json({ error: 'Unauthorized - missing or malformed authorization header' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Client for user auth verification
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return json({ error: 'Unauthorized - invalid token' }, 401);
    }

    console.log('Authenticated user:', user.id);

    // Parse request body
    const { filePath } = await req.json();

    if (typeof filePath !== 'string' || !FILE_PATH_REGEX.test(filePath)) {
      return json({ error: 'Invalid file path' }, 400);
    }

    // Create admin client for role checking and signed URL generation
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    const isAdmin = !!roleData;
    console.log('Is admin:', isAdmin);

    // Extract user ID from file path (format: {userId}/filename.png)
    const pathParts = filePath.split('/');
    const fileUserId = pathParts[0];

    // Authorization check: non-admins can only access files in their own folder
    if (!isAdmin && fileUserId !== user.id) {
      return json({ error: 'Access denied - you can only access your own files' }, 403);
    }

    // Generate signed URL with 15-minute expiry using admin client
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
      .storage
      .from('pass-documents')
      .createSignedUrl(filePath, 900); // 900 seconds = 15 minutes

    if (signedUrlError) {
      console.error('Error creating signed URL:', signedUrlError);
      return json({ error: 'Failed to create signed URL', details: signedUrlError.message }, 500);
    }

    console.log('Signed URL created successfully');

    return json({ signedUrl: signedUrlData.signedUrl });

  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: 'Internal server error', details: message }, 500);
  }
});
