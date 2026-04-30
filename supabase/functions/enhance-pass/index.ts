import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Authentication: require a valid JWT ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    const authUserId = claimsData.claims.sub as string;

    // --- Input validation ---
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    const { filePath, userId } = body as { filePath?: unknown; userId?: unknown };

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof userId !== 'string' || !uuidRegex.test(userId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid userId' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    if (
      typeof filePath !== 'string' ||
      filePath.includes('..') ||
      !/^[0-9a-f-]+\/[^/]+\.(jpg|jpeg|png)$/i.test(filePath)
    ) {
      return new Response(
        JSON.stringify({ error: 'Invalid filePath' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Ownership: userId in body must match the JWT's user, and filePath must be under that user's folder
    if (userId !== authUserId) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }
    if (!filePath.startsWith(`${authUserId}/`)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Service-role client used only after auth + ownership checks
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Download the original image
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('pass-documents')
      .download(filePath);

    if (downloadError) {
      console.error('Download error:', downloadError);
      throw new Error('Failed to download image');
    }

    // Convert blob to array buffer and base64 for OCR
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Convert to base64 for OCR
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Image = btoa(binary);
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    // Use Lovable AI vision model to extract text
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all text from this bus pass image, especially look for expiry date or valid until date. Return the complete text you can read from the image.'
              },
              {
                type: 'image_url',
                image_url: { url: dataUrl }
              }
            ]
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', errorText);
      
      if (aiResponse.status === 402) {
        throw new Error('Lovable AI credits exhausted. Please add credits to your workspace at Settings → Workspace → Usage to continue using pass enhancement features.');
      } else if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a few moments.');
      }
      
      throw new Error('Failed to process image with AI');
    }

    const aiData = await aiResponse.json();
    const text = aiData.choices?.[0]?.message?.content || '';

    // Extract expiry date and pass ID using regex patterns
    const expiryDate = extractExpiryDate(text);
    const passId = extractPassId(text);

    // Check if pass is expired
    const isExpired = expiryDate ? new Date(expiryDate) < new Date() : false;

    // Get public URL of the original uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from('pass-documents')
      .getPublicUrl(filePath);

    // Update passes table
    const updateData: any = {
      monthly_pass_url: publicUrl,
    };

    if (expiryDate) {
      updateData.expiry_date = expiryDate;
    }

    if (passId) {
      updateData.buss_pass_id = passId;
      
      // Extract only numeric characters for duplicate checking
      const numericPassId = passId.replace(/\D/g, '');
      
      // Check for duplicate pass IDs (numeric comparison) if numeric portion is at least 4 digits
      if (numericPassId.length >= 4) {
        const { data: allPasses, error: duplicateError } = await supabase
          .from('passes')
          .select('user_id, id, buss_pass_id')
          .not('buss_pass_id', 'is', null)
          .neq('user_id', userId);

        if (duplicateError) {
          console.error('Duplicate check error:', duplicateError);
        }

        // Find duplicates by comparing numeric portions
        const duplicates: any[] = [];
        if (allPasses) {
          for (const existingPass of allPasses) {
            const existingNumeric = (existingPass.buss_pass_id || '').replace(/\D/g, '');
            if (existingNumeric === numericPassId && existingNumeric.length >= 4) {
              duplicates.push(existingPass);
            }
          }
        }

        if (duplicates.length > 0) {
          // Mark current pass as unverified
          updateData.verified = false;
          
          // Mark all duplicate passes as unverified
          for (const duplicate of duplicates) {
            await supabase
              .from('passes')
              .update({ verified: false })
              .eq('id', duplicate.id);
          }

          // Get admin user IDs
          const { data: admins } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'admin');

          // Create alerts for all admins
          if (admins && admins.length > 0) {
            const alertPromises = admins.map(admin =>
              supabase.from('alerts').insert({
                user_id: admin.user_id,
                type: 'duplicate_pass',
                status: 'pending',
                message: `Duplicate Bus Pass ID detected (numeric: ${numericPassId}). Multiple users have passes with the same numeric ID. Please investigate immediately.`,
                send_at: new Date().toISOString()
              })
            );
            await Promise.all(alertPromises);
          }
        }
      }
    }

    const { error: updateError } = await supabase
      .from('passes')
      .update(updateData)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Update error:', updateError);
      throw new Error('Failed to update pass data');
    }

    // Also update profiles table with expiry date
    if (expiryDate) {
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ pass_expiry_date: expiryDate })
        .eq('id', userId);

      if (profileUpdateError) {
        console.error('Profile update error:', profileUpdateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        expiryDate,
        passId,
        isExpired,
        imageUrl: publicUrl 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in enhance-pass function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function extractExpiryDate(text: string): string | null {
  // Common date patterns including dates with month names
  const patterns = [
    // DD-MMM-YYYY format (e.g., 05-Nov-2025)
    /(?:to|until|till|expiry|expire|valid until|valid till|expires on|exp)[:\s]*(\d{1,2}[-\s](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\s]\d{4})/i,
    // Standard numeric patterns
    /(?:expiry|expire|valid until|valid till|expires on|exp)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i,
    /(?:expiry|expire|valid until|valid till|expires on|exp)[:\s]*(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i,
    // Validity range pattern (capture the end date)
    /validity[:\s]*\d{1,2}[-\/\.]\w{3}[-\/\.]\d{4}\s+to\s+(\d{1,2}[-\/\.]\w{3}[-\/\.]\d{4})/i,
    // Generic date patterns
    /(\d{1,2}[-\s](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\s]\d{4})/i,
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/,
    /(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const dateStr = match[1];
      try {
        // Parse date and convert to ISO format
        const parsedDate = parseDateString(dateStr);
        if (parsedDate && !isNaN(parsedDate.getTime())) {
          return parsedDate.toISOString().split('T')[0];
        }
      } catch (e) {
        console.log('Date parsing error:', e);
      }
    }
  }

  return null;
}

function extractPassId(text: string): string | null {
  // Look for pass ID patterns like "Pass ID: XXXXX" or "ID: XXXXX" or just alphanumeric IDs
  const patterns = [
    /(?:bus\s*pass\s*id|pass\s*id|id\s*no|id)[:\s#]*([A-Z0-9\-]+)/i,
    /(?:pass\s*number|ticket\s*number|number)[:\s#]*([A-Z0-9\-]+)/i,
    /\b([A-Z]{2,}\d{4,}|\d{4,}[A-Z]{2,})\b/i, // Pattern like ABC1234 or 1234ABC
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const id = match[1].trim();
      // Ensure it's at least 4 characters long to avoid false positives
      if (id.length >= 4) {
        return id.toUpperCase();
      }
    }
  }

  return null;
}

function parseDateString(dateStr: string): Date | null {
  // Month name to number mapping
  const monthMap: { [key: string]: string } = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };

  // Try different date formats
  const formats = [
    // DD-MMM-YYYY or DD MMM YYYY (e.g., 05-Nov-2025 or 05 Nov 2025)
    /^(\d{1,2})[-\s](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\s](\d{4})$/i,
    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/,
    // YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
    /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/,
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[0]) {
        // DD-MMM-YYYY format
        const [, day, month, year] = match;
        const monthNum = monthMap[month.toLowerCase()];
        if (monthNum) {
          return new Date(`${year}-${monthNum}-${day.padStart(2, '0')}`);
        }
      } else if (format === formats[1]) {
        // DD/MM/YYYY format
        const [, day, month, year] = match;
        return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      } else {
        // YYYY/MM/DD format
        const [, year, month, day] = match;
        return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      }
    }
  }

  return null;
}

