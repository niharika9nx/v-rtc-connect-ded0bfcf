import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { extractBearerToken } from '../_shared/auth.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  const cors = corsHeaders(req.headers.get('origin'));

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  // Testing utility: disabled unless explicitly enabled via env flag
  if (Deno.env.get('ENABLE_TEST_ALERTS') !== 'true') {
    return json({ error: 'Not found' }, 404);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const token = extractBearerToken(req);
    if (!token) {
      return json({ error: 'Unauthorized: Missing or malformed authorization header' }, 401);
    }

    // Create a client with the user's token to verify they're authenticated
    const userSupabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await userSupabase.auth.getUser(token);
    if (userError || !user) {
      console.error('Auth error:', userError);
      return json({ error: 'Unauthorized: Invalid user session' }, 401);
    }

    // Create admin client to check role
    const adminSupabase = createClient(supabaseUrl, supabaseKey);

    // Check if user has admin role
    const { data: roleData, error: roleError } = await adminSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      console.error('Role check failed:', roleError);
      return json({ error: 'Forbidden: Admin access required' }, 403);
    }

    const { userId, type, message } = await req.json();

    if (typeof userId !== 'string' || !UUID_REGEX.test(userId)) {
      return json({ error: 'Invalid or missing userId' }, 400);
    }

    if (typeof type !== 'string' || type.length === 0 || type.length > 100) {
      return json({ error: 'Invalid type' }, 400);
    }

    if (typeof message !== 'string' || message.length === 0 || message.length > 2000) {
      return json({ error: 'Invalid message' }, 400);
    }

    console.log('Admin', user.id, 'creating test alert for user:', userId);

    // Create a test alert using admin client
    const { data, error } = await adminSupabase
      .from('alerts')
      .insert({
        user_id: userId,
        type: type,
        status: 'pending',
        message: message,
        send_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    console.log('Test alert created:', data);

    return json({ success: true, alert: data });

  } catch (error: any) {
    console.error('Error in create-test-alert function:', error);
    return json({ error: error.message }, 500);
  }
});
