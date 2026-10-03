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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const token = extractBearerToken(req);
    if (!token) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // Get the JWT token and verify the user
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      console.error('Auth error:', authError);
      return json({ error: 'Invalid token' }, 401);
    }

    console.log('Requesting user:', requestingUser.id);

    // Check if the requesting user is an admin using the has_role function
    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc('has_role', {
      _user_id: requestingUser.id,
      _role: 'admin',
    });

    if (roleError) {
      console.error('Role check error:', roleError);
      return json({ error: 'Failed to verify admin role' }, 500);
    }

    if (!isAdmin) {
      console.error('User is not an admin');
      return json({ error: 'Only admins can delete users' }, 403);
    }

    // Get the user ID to delete from the request body
    const { userId } = await req.json();

    if (typeof userId !== 'string' || !UUID_REGEX.test(userId)) {
      return json({ error: 'Invalid or missing userId' }, 400);
    }

    console.log('Attempting to delete user:', userId);

    // Prevent admin from deleting themselves
    if (userId === requestingUser.id) {
      return json({ error: 'Cannot delete your own account' }, 400);
    }

    // Prevent deleting other admins to avoid lockout
    const { data: targetIsAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    });

    if (targetIsAdmin) {
      return json({ error: 'Cannot delete admin users' }, 403);
    }

    // Delete user's pass documents from storage first
    const { data: passData } = await supabaseAdmin
      .from('passes')
      .select('identity_card_url, monthly_pass_url')
      .eq('user_id', userId)
      .maybeSingle();

    if (passData) {
      const filesToDelete: string[] = [];

      if (passData.identity_card_url) {
        // Extract path from URL if it's a full URL
        const idPath = passData.identity_card_url.includes('pass-documents/')
          ? passData.identity_card_url.split('pass-documents/')[1]
          : passData.identity_card_url;
        if (idPath) filesToDelete.push(idPath);
      }

      if (passData.monthly_pass_url) {
        const passPath = passData.monthly_pass_url.includes('pass-documents/')
          ? passData.monthly_pass_url.split('pass-documents/')[1]
          : passData.monthly_pass_url;
        if (passPath) filesToDelete.push(passPath);
      }

      if (filesToDelete.length > 0) {
        console.log('Deleting pass documents:', filesToDelete);
        await supabaseAdmin.storage.from('pass-documents').remove(filesToDelete);
      }
    }

    // Delete the user from auth.users (this will cascade to profiles, user_roles, etc.)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      return json({ error: deleteError.message }, 500);
    }

    console.log('User deleted successfully:', userId);

    return json({ success: true, message: 'User deleted successfully' });

  } catch (error: any) {
    console.error('Error in delete-user function:', error);
    return json({ error: error.message }, 500);
  }
});
