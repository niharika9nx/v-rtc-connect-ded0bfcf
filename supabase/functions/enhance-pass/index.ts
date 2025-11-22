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

    // Convert blob to array buffer and then to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to base64 in chunks to avoid stack overflow
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Image = btoa(binary);
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

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

    // Extract expiry date using regex patterns
    const expiryDate = extractExpiryDate(text);
    console.log('Extracted expiry date:', expiryDate);

    // Check if pass is expired
    const isExpired = expiryDate ? new Date(expiryDate) < new Date() : false;
    console.log('Pass expired:', isExpired);

    // Enhance and process image
    const enhancedImageBlob = await enhanceImage(uint8Array, isExpired);

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

    const { error: updateError } = await supabase
      .from('passes')
      .update(updateData)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Update error:', updateError);
      throw new Error('Failed to update pass data');
    }

    console.log('Pass data updated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        expiryDate, 
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
  // Common date patterns: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD
  const patterns = [
    /(?:expiry|expire|valid until|valid till|expires on|exp)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i,
    /(?:expiry|expire|valid until|valid till|expires on|exp)[:\s]*(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i,
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

function parseDateString(dateStr: string): Date | null {
  // Try different date formats
  const formats = [
    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/,
    // YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
    /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/,
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[0]) {
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
