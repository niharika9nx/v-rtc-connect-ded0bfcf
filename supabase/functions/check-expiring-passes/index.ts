import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { extractBearerToken } from '../_shared/auth.ts';

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
      return json({ error: 'Unauthorized: Missing or malformed authorization header' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Validate the cron token as a proper service-role JWT instead of
    // comparing it against the raw key value.
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: { user: cronUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !cronUser) {
      console.error('Invalid cron token:', authError);
      return json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    console.log('Authorization verified, checking for expiring passes...');

    const today = new Date().toISOString().split('T')[0];
    const todayDate = new Date(today);

    // Calculate dates for the next 5 days
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    const fiveDaysDate = fiveDaysFromNow.toISOString().split('T')[0];

    // Get profiles with passes expiring within the next 1-5 days
    const { data: expiringProfiles, error: expiringError } = await supabase
      .from('profiles')
      .select('id, pass_expiry_date')
      .gt('pass_expiry_date', today)
      .lte('pass_expiry_date', fiveDaysDate);

    if (expiringError) throw expiringError;

    console.log(`Found ${expiringProfiles?.length || 0} passes expiring within 5 days`);

    // Create daily countdown alerts for expiring passes
    for (const profile of expiringProfiles || []) {
      // Check if there's already an alert for today
      const { data: existingTodayAlert } = await supabase
        .from('alerts')
        .select('*')
        .eq('user_id', profile.id)
        .eq('type', 'pass_expiry_warning')
        .eq('status', 'pending')
        .gte('send_at', today);

      // Only create a new alert if there isn't one already today
      if (!existingTodayAlert || existingTodayAlert.length === 0) {
        const expiryDate = new Date(profile.pass_expiry_date);
        const daysRemaining = Math.ceil((expiryDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

        const message = daysRemaining === 1
          ? `⚠️ Your bus pass expires TOMORROW (${new Date(profile.pass_expiry_date).toLocaleDateString()})! Please upload a new pass urgently.`
          : `⏰ Your bus pass will expire in ${daysRemaining} days (${new Date(profile.pass_expiry_date).toLocaleDateString()}). Please upload a new pass soon.`;

        const { error: alertError } = await supabase
          .from('alerts')
          .insert({
            user_id: profile.id,
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

    // Get profiles with expired passes
    const { data: expiredProfiles, error: expiredError } = await supabase
      .from('profiles')
      .select('id, pass_expiry_date')
      .lt('pass_expiry_date', today);

    if (expiredError) throw expiredError;

    console.log(`Found ${expiredProfiles?.length || 0} expired passes`);

    // For expired passes, check if there's already a pending renewal reminder
    for (const profile of expiredProfiles || []) {
      // Check if there's already a pending renewal reminder sent today
      const { data: existingAlerts } = await supabase
        .from('alerts')
        .select('*')
        .eq('user_id', profile.id)
        .eq('type', 'pass_renewal_reminder')
        .eq('status', 'pending')
        .gte('send_at', today);

      // Only create a new reminder if there isn't one already today
      if (!existingAlerts || existingAlerts.length === 0) {
        const daysSinceExpiry = Math.floor((todayDate.getTime() - new Date(profile.pass_expiry_date).getTime()) / (1000 * 60 * 60 * 24));

        const message = daysSinceExpiry === 0
          ? '🚨 Your bus pass expired TODAY! Did you receive your new bus pass?'
          : `🚨 Your bus pass expired ${daysSinceExpiry} day${daysSinceExpiry > 1 ? 's' : ''} ago! Did you receive your new bus pass?`;

        const { error: reminderError } = await supabase
          .from('alerts')
          .insert({
            user_id: profile.id,
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

    return json({
      success: true,
      expiringCount: expiringProfiles?.length || 0,
      expiredCount: expiredProfiles?.length || 0
    });

  } catch (error: any) {
    console.error('Error in check-expiring-passes function:', error);
    return json({ error: error.message }, 500);
  }
});
