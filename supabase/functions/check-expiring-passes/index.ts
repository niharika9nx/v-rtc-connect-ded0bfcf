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

    console.log('Checking for expiring passes...');

    const today = new Date().toISOString().split('T')[0];
    const todayDate = new Date(today);

    // Calculate dates for the next 5 days
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    const fiveDaysDate = fiveDaysFromNow.toISOString().split('T')[0];

    // Get passes expiring within the next 1-5 days
    const { data: expiringPasses, error: expiringError } = await supabase
      .from('passes')
      .select('user_id, expiry_date')
      .gt('expiry_date', today)
      .lte('expiry_date', fiveDaysDate);

    if (expiringError) throw expiringError;

    console.log(`Found ${expiringPasses?.length || 0} passes expiring within 5 days`);

    // Create daily countdown alerts for expiring passes
    for (const pass of expiringPasses || []) {
      // Check if there's already an alert for today
      const { data: existingTodayAlert } = await supabase
        .from('alerts')
        .select('*')
        .eq('user_id', pass.user_id)
        .eq('type', 'pass_expiry_warning')
        .eq('status', 'pending')
        .gte('send_at', today);

      // Only create a new alert if there isn't one already today
      if (!existingTodayAlert || existingTodayAlert.length === 0) {
        const expiryDate = new Date(pass.expiry_date);
        const daysRemaining = Math.ceil((expiryDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
        
        const message = daysRemaining === 1 
          ? `⚠️ Your bus pass expires TOMORROW (${new Date(pass.expiry_date).toLocaleDateString()})! Please upload a new pass urgently.`
          : `⏰ Your bus pass will expire in ${daysRemaining} days (${new Date(pass.expiry_date).toLocaleDateString()}). Please upload a new pass soon.`;

        const { error: alertError } = await supabase
          .from('alerts')
          .insert({
            user_id: pass.user_id,
            type: 'pass_expiry_warning',
            status: 'pending',
            message: message,
            send_at: new Date().toISOString()
          });

        if (alertError) {
          console.error('Error creating alert:', alertError);
        }
      }
    }

    // Get passes that have expired
    const { data: expiredPasses, error: expiredError } = await supabase
      .from('passes')
      .select('user_id, expiry_date')
      .lt('expiry_date', today);

    if (expiredError) throw expiredError;

    console.log(`Found ${expiredPasses?.length || 0} expired passes`);

    // For expired passes, check if there's already a pending renewal reminder
    for (const pass of expiredPasses || []) {
      // Check if there's already a pending renewal reminder sent today
      const { data: existingAlerts } = await supabase
        .from('alerts')
        .select('*')
        .eq('user_id', pass.user_id)
        .eq('type', 'pass_renewal_reminder')
        .eq('status', 'pending')
        .gte('send_at', today);

      // Only create a new reminder if there isn't one already today
      if (!existingAlerts || existingAlerts.length === 0) {
        const daysSinceExpiry = Math.floor((todayDate.getTime() - new Date(pass.expiry_date).getTime()) / (1000 * 60 * 60 * 24));
        
        const message = daysSinceExpiry === 0
          ? '🚨 Your bus pass expired TODAY! Did you receive your new bus pass?'
          : `🚨 Your bus pass expired ${daysSinceExpiry} day${daysSinceExpiry > 1 ? 's' : ''} ago! Did you receive your new bus pass?`;

        const { error: reminderError } = await supabase
          .from('alerts')
          .insert({
            user_id: pass.user_id,
            type: 'pass_renewal_reminder',
            status: 'pending',
            message: message,
            send_at: new Date().toISOString()
          });

        if (reminderError) {
          console.error('Error creating reminder:', reminderError);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        expiringCount: expiringPasses?.length || 0,
        expiredCount: expiredPasses?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in check-expiring-passes function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
