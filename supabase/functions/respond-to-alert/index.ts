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

  try {
    const token = extractBearerToken(req);
    if (!token) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const { alertId, response } = await req.json();

    if (typeof alertId !== 'string' || !UUID_REGEX.test(alertId)) {
      return json({ error: 'Invalid alertId' }, 400);
    }

    if (response !== 'yes' && response !== 'no') {
      return json({ error: 'Invalid response' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const newStatus = response === 'yes' ? 'resolved' : 'pending';

    const { error: updateError } = await supabase
      .from('alerts')
      .update({
        status: newStatus,
        user_response: response
      })
      .eq('id', alertId)
      .eq('user_id', user.id);

    if (updateError) throw updateError;

    if (response === 'yes') {
      const { error: resolveError } = await supabase
        .from('alerts')
        .update({ status: 'resolved' })
        .eq('user_id', user.id)
        .eq('type', 'pass_renewal_reminder')
        .eq('status', 'pending');

      if (resolveError) {
        console.error('Error resolving reminders:', resolveError);
      }
    }

    return json({ success: true });

  } catch (error: any) {
    console.error('Error in respond-to-alert function:', error);
    return json({ error: error.message }, 500);
  }
});
