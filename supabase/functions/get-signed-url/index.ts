import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header to verify the user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - no auth header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Client for user auth verification
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    // Parse request body
    const { filePath, targetUserId } = await req.json();
    
    if (!filePath) {
      return new Response(
        JSON.stringify({ error: 'File path is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Requested file path:', filePath);
    console.log('Target user ID:', targetUserId);

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
    
    // Authorization check: user can only access their own files OR admins can access any file
    if (!isAdmin && fileUserId !== user.id && targetUserId !== user.id) {
      console.error('Access denied - user trying to access another users file');
      return new Response(
        JSON.stringify({ error: 'Access denied - you can only access your own files' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate signed URL with 15-minute expiry using admin client
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
      .storage
      .from('pass-documents')
      .createSignedUrl(filePath, 900); // 900 seconds = 15 minutes

    if (signedUrlError) {
      console.error('Error creating signed URL:', signedUrlError);
      return new Response(
        JSON.stringify({ error: 'Failed to create signed URL', details: signedUrlError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Signed URL created successfully');

    return new Response(
      JSON.stringify({ signedUrl: signedUrlData.signedUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
