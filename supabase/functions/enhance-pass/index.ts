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
    const { filePath, userId } = await req.json();
    console.log('Processing pass enhancement for:', filePath);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download the original image
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('pass-documents')
      .download(filePath);

    if (downloadError) {
      console.error('Download error:', downloadError);
      throw new Error('Failed to download image');
    }

    console.log('Image downloaded successfully');

    // Convert blob to array buffer
    const arrayBuffer = await fileData.arrayBuffer();
    let uint8Array = new Uint8Array(arrayBuffer);
    
    // Compress image to reduce size for faster processing
    console.log('Original image size:', uint8Array.length, 'bytes');
    
    // Convert to base64 for compression via AI
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Image = btoa(binary);
    
    // Compress image using Lovable AI (resize to max 1024px width)
    console.log('Compressing image...');
    const compressionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Resize this image to a maximum width of 1024px while maintaining aspect ratio and quality. Return the compressed image.'
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${base64Image}` }
              }
            ]
          }
        ],
        modalities: ['image']
      }),
    });

    let compressedBase64 = base64Image;
    if (compressionResponse.ok) {
      const compressionData = await compressionResponse.json();
      const compressedUrl = compressionData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (compressedUrl) {
        compressedBase64 = compressedUrl.split(',')[1];
        console.log('Image compressed successfully');
      }
    } else {
      console.log('Compression failed, using original image');
    }
    
    const dataUrl = `data:image/jpeg;base64,${compressedBase64}`;

    console.log('Starting OCR processing with Lovable AI...');
    
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
      console.error('AI gateway error:', await aiResponse.text());
      throw new Error('Failed to process image with AI');
    }

    const aiData = await aiResponse.json();
    const text = aiData.choices?.[0]?.message?.content || '';
    
    console.log('OCR text extracted:', text);

    // Extract expiry date and pass ID using regex patterns
    const expiryDate = extractExpiryDate(text);
    const passId = extractPassId(text);
    console.log('Extracted expiry date:', expiryDate);
    console.log('Extracted pass ID:', passId);

    // Check if pass is expired
    const isExpired = expiryDate ? new Date(expiryDate) < new Date() : false;
    console.log('Pass expired:', isExpired);

    // Enhance and process image - convert compressed base64 back to blob
    const compressedBinary = atob(compressedBase64);
    const compressedBytes = new Uint8Array(compressedBinary.length);
    for (let i = 0; i < compressedBinary.length; i++) {
      compressedBytes[i] = compressedBinary.charCodeAt(i);
    }
    const enhancedImageBlob = await enhanceImage(compressedBytes, isExpired);

    console.log('Compressed image size:', compressedBytes.length, 'bytes');

    // Upload enhanced image
    const enhancedFileName = filePath.replace('monthly_pass', 'monthly_pass_enhanced');
    const { error: uploadError } = await supabase.storage
      .from('pass-documents')
      .upload(enhancedFileName, enhancedImageBlob, { 
        upsert: true,
        contentType: 'image/png'
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Failed to upload enhanced image');
    }

    console.log('Enhanced image uploaded');

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('pass-documents')
      .getPublicUrl(enhancedFileName);

    // Update passes table
    const updateData: any = {
      monthly_pass_url: publicUrl,
    };

    if (expiryDate) {
      updateData.expiry_date = expiryDate;
    }

    if (passId) {
      updateData.buss_pass_id = passId;
      
      // Check for duplicate pass IDs
      const { data: duplicates, error: duplicateError } = await supabase
        .from('passes')
        .select('user_id, id')
        .eq('buss_pass_id', passId)
        .neq('user_id', userId);

      if (duplicateError) {
        console.error('Duplicate check error:', duplicateError);
      }

      if (duplicates && duplicates.length > 0) {
        console.log('Duplicate pass ID detected:', passId);
        
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
              message: `Duplicate Bus Pass ID detected: ${passId}. Multiple users have the same pass ID. Please investigate immediately.`,
              send_at: new Date().toISOString()
            })
          );
          await Promise.all(alertPromises);
        }

        console.log('Admins notified about duplicate pass ID');
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

    console.log('Pass data updated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        expiryDate,
        passId,
        isExpired,
        enhancedUrl: publicUrl 
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

async function enhanceImage(imageData: Uint8Array, isExpired: boolean): Promise<Blob> {
  // For image enhancement in Deno, we'll use a simple approach
  // In production, you might want to use more sophisticated image processing
  
  // Convert to blob with proper typing
  const buffer = imageData.buffer as ArrayBuffer;
  const blob = new Blob([buffer], { type: 'image/jpeg' });
  
  // If expired, we need to overlay text
  // For now, we'll return the original image and handle overlay on client side
  // In a full implementation, you'd use canvas or image processing library
  
  return blob;
}
