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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, type, message } = await req.json();

    console.log('Creating test alert for user:', userId);

    // Create a test alert
    const { data, error } = await supabase
      .from('alerts')
      .insert({
        user_id: userId,
        type: type || 'pass_expiry_warning',
        status: 'pending',
        message: message || 'Your bus pass will expire soon. Please upload a new pass.',
        send_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    console.log('Test alert created:', data);

    return new Response(
      JSON.stringify({ success: true, alert: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in create-test-alert function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
