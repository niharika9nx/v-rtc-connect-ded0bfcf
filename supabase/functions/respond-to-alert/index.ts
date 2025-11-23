import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { alertId, response } = await req.json();
    
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('Responding to alert:', alertId, 'with response:', response);

    // Update alert status and user_response based on response
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

    // If user says yes (they got a new pass), mark all pending renewal reminders as resolved
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

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in respond-to-alert function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
