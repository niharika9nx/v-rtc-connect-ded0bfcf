import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, CreditCard, Upload, RefreshCw, ZoomIn, ZoomOut, Maximize2, X, Check, Trash2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Tesseract from 'tesseract.js';

const EPass = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pass, setPass] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [identityCardFile, setIdentityCardFile] = useState<File | null>(null);
  const [monthlyPassFile, setMonthlyPassFile] = useState<File | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [selectedImage, setSelectedImage] = useState<{ url: string; title: string } | null>(null);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [extractedPassId, setExtractedPassId] = useState('');
  const [extractedExpiryDate, setExtractedExpiryDate] = useState('');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [deletingIdentity, setDeletingIdentity] = useState(false);
  const [deletingMonthly, setDeletingMonthly] = useState(false);
  const [feeStatus, setFeeStatus] = useState<any>(null);

  useEffect(() => {
    fetchPass();
    checkFeeStatus();
    
    // Set up real-time subscription for pass changes (to detect when marked as fake)
    if (user) {
      const channel = supabase
        .channel('pass-updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'passes',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Pass updated:', payload);
            setPass(payload.new);
            
            // Show notification if pass was marked as fake
            if (payload.new.verified === false && payload.old?.verified === true) {
              toast({
                title: "⚠️ Pass Marked as FAKE",
                description: "Your pass has been marked as unverified due to duplicate numeric ID detection.",
                variant: "destructive",
                duration: 10000
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const checkFeeStatus = async () => {
    if (!user) return;
    
    const currentMonth = new Date().toLocaleString('default', { month: 'long' });
    const currentYear = new Date().getFullYear();
    
    const { data: feeData } = await supabase
      .from('fee_history')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .eq('status', 'paid')
      .maybeSingle();
    
    setFeeStatus(feeData);
  };

  const fetchPass = async () => {
    if (user) {
      const { data } = await supabase
        .from('passes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      setPass(data);
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchPass();
      toast({
        title: "Refreshed",
        description: "Pass data reloaded successfully"
      });
    } catch (error: any) {
      toast({
        title: "Refresh failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setRefreshing(false);
    }
  };

  const openImageModal = (url: string, title: string) => {
    setSelectedImage({ url, title });
    setImageZoom(1);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
    setImageZoom(1);
  };

  const handleZoomIn = () => {
    setImageZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setImageZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const resetZoom = () => {
    setImageZoom(1);
  };

  const cleanupOldFiles = async (prefix: string) => {
    if (!user) return;
    
    try {
      // List all files for this user with the given prefix
      const { data: files } = await supabase.storage
        .from('pass-documents')
        .list(`${user.id}`, {
          search: prefix
        });

      if (files && files.length > 0) {
        // Delete all old files with this prefix
        const filesToDelete = files.map(file => `${user.id}/${file.name}`);
        await supabase.storage
          .from('pass-documents')
          .remove(filesToDelete);
        
        console.log(`Cleaned up ${filesToDelete.length} old files with prefix: ${prefix}`);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
      // Don't throw - cleanup failure shouldn't block upload
    }
  };

  const enhanceImageQuality = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }

      img.onload = () => {
        // Use original dimensions or scale up slightly for better quality
        const scaleFactor = 1.5;
        canvas.width = img.width * scaleFactor;
        canvas.height = img.height * scaleFactor;

        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw image with high quality
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Convert to high-quality PNG (lossless)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log('Enhanced image quality - size:', blob.size);
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob'));
            }
          },
          'image/png',
          1.0  // Maximum quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const uploadFile = async (file: File, type: 'identity_card' | 'monthly_pass') => {
    if (!user) return null;

    // Clean up old files before uploading new one
    await cleanupOldFiles(type);

    // Enhance image quality before upload
    const enhancedBlob = await enhanceImageQuality(file);
    const enhancedFile = new File([enhancedBlob], `${type}.png`, { type: 'image/png' });

    const fileName = `${user.id}/${type}.png`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage
      .from('pass-documents')
      .upload(filePath, enhancedFile, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('pass-documents')
      .getPublicUrl(filePath);

    return { publicUrl, filePath };
  };

  const handleIdentityCardUpload = async () => {
    if (!user || !identityCardFile) {
      toast({
        title: "No file selected",
        description: "Please select an identity card to upload",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      const uploadResult = await uploadFile(identityCardFile, 'identity_card');
      
      if (!uploadResult) throw new Error('Upload failed');

      const passData = {
        user_id: user.id,
        identity_card_url: uploadResult.publicUrl
      };

      if (pass) {
        await supabase
          .from('passes')
          .update({ identity_card_url: uploadResult.publicUrl })
          .eq('id', pass.id);
      } else {
        await supabase
          .from('passes')
          .insert(passData);
      }

      toast({
        title: "Success",
        description: "Identity card uploaded successfully"
      });

      setIdentityCardFile(null);
      fetchPass();
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const preprocessImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }

      img.onload = () => {
        // Adaptive scale factor based on image size (target 300 DPI minimum)
        const minDimension = Math.min(img.width, img.height);
        const scaleFactor = minDimension < 1000 ? 3 : minDimension < 1500 ? 2.5 : 2;
        
        canvas.width = img.width * scaleFactor;
        canvas.height = img.height * scaleFactor;

        // Enable high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw image with high quality
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Get image data for processing
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // 1. Grayscale conversion with improved weights
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }

        // 2. Adaptive histogram equalization for better contrast
        const histEq = new Uint8ClampedArray(data);
        const histogram = new Array(256).fill(0);
        
        // Build histogram
        for (let i = 0; i < data.length; i += 4) {
          histogram[data[i]]++;
        }
        
        // Calculate CDF
        const cdf = new Array(256).fill(0);
        cdf[0] = histogram[0];
        for (let i = 1; i < 256; i++) {
          cdf[i] = cdf[i - 1] + histogram[i];
        }
        
        // Normalize CDF
        const cdfMin = cdf.find(v => v > 0) || 0;
        const totalPixels = canvas.width * canvas.height;
        
        for (let i = 0; i < data.length; i += 4) {
          const newValue = Math.round(((cdf[data[i]] - cdfMin) / (totalPixels - cdfMin)) * 255);
          histEq[i] = newValue;
          histEq[i + 1] = newValue;
          histEq[i + 2] = newValue;
        }

        // 3. Sharpening filter (unsharp mask)
        const sharpened = new Uint8ClampedArray(histEq);
        const sharpenKernel = [
          0, -1, 0,
          -1, 5, -1,
          0, -1, 0
        ];
        
        for (let y = 1; y < canvas.height - 1; y++) {
          for (let x = 1; x < canvas.width - 1; x++) {
            let sum = 0;
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const idx = ((y + ky) * canvas.width + (x + kx)) * 4;
                const kernelIdx = (ky + 1) * 3 + (kx + 1);
                sum += histEq[idx] * sharpenKernel[kernelIdx];
              }
            }
            const idx = (y * canvas.width + x) * 4;
            sharpened[idx] = Math.min(255, Math.max(0, sum));
            sharpened[idx + 1] = sharpened[idx];
            sharpened[idx + 2] = sharpened[idx];
          }
        }

        // 4. Otsu's binarization (improved implementation)
        let threshold = 128;
        const binHistogram = new Array(256).fill(0);
        
        for (let i = 0; i < sharpened.length; i += 4) {
          binHistogram[sharpened[i]]++;
        }
        
        let sum = 0;
        for (let i = 0; i < 256; i++) sum += i * binHistogram[i];
        
        let sumB = 0;
        let wB = 0;
        let wF = 0;
        let varMax = 0;
        
        for (let t = 0; t < 256; t++) {
          wB += binHistogram[t];
          if (wB === 0) continue;
          
          wF = totalPixels - wB;
          if (wF === 0) break;
          
          sumB += t * binHistogram[t];
          const mB = sumB / wB;
          const mF = (sum - sumB) / wF;
          const varBetween = wB * wF * (mB - mF) * (mB - mF);
          
          if (varBetween > varMax) {
            varMax = varBetween;
            threshold = t;
          }
        }

        // Apply adaptive threshold (slightly adjust based on local variance)
        threshold = Math.max(100, Math.min(180, threshold));
        
        for (let i = 0; i < sharpened.length; i += 4) {
          const value = sharpened[i] > threshold ? 255 : 0;
          sharpened[i] = value;
          sharpened[i + 1] = value;
          sharpened[i + 2] = value;
        }

        // 5. Morphological operations: dilation to connect broken characters
        const dilated = new Uint8ClampedArray(sharpened);
        const structElement = 1; // 3x3 structuring element
        
        for (let y = structElement; y < canvas.height - structElement; y++) {
          for (let x = structElement; x < canvas.width - structElement; x++) {
            let maxVal = 0;
            for (let dy = -structElement; dy <= structElement; dy++) {
              for (let dx = -structElement; dx <= structElement; dx++) {
                const idx = ((y + dy) * canvas.width + (x + dx)) * 4;
                maxVal = Math.max(maxVal, sharpened[idx]);
              }
            }
            const idx = (y * canvas.width + x) * 4;
            dilated[idx] = maxVal;
            dilated[idx + 1] = maxVal;
            dilated[idx + 2] = maxVal;
          }
        }

        // 6. Advanced noise removal (5x5 median filter for better results)
        const filtered = new Uint8ClampedArray(dilated);
        const filterSize = 2; // 5x5 window
        
        for (let y = filterSize; y < canvas.height - filterSize; y++) {
          for (let x = filterSize; x < canvas.width - filterSize; x++) {
            const neighbors = [];
            for (let dy = -filterSize; dy <= filterSize; dy++) {
              for (let dx = -filterSize; dx <= filterSize; dx++) {
                const idx = ((y + dy) * canvas.width + (x + dx)) * 4;
                neighbors.push(dilated[idx]);
              }
            }
            neighbors.sort((a, b) => a - b);
            const median = neighbors[Math.floor(neighbors.length / 2)];
            const idx = (y * canvas.width + x) * 4;
            filtered[idx] = median;
            filtered[idx + 1] = median;
            filtered[idx + 2] = median;
          }
        }

        // Put final processed image back
        ctx.putImageData(new ImageData(filtered, canvas.width, canvas.height), 0, 0);

        // Convert to high-quality PNG blob
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        }, 'image/png', 1.0);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const extractDateFromText = (text: string): string | null => {
    console.log('Extracting date from:', text);
    
    // Normalize text: fix common OCR errors and make case-insensitive
    let normalizedText = text
      .toLowerCase()
      .replace(/[|!]/g, 'i')  // Pipe and exclamation to i
      .replace(/[o]/g, '0')   // o to 0 for numbers
      .replace(/\s+/g, ' ')   // Normalize whitespace
      .trim();
    
    console.log('Normalized text:', normalizedText);
    
    // Enhanced month mapping with common OCR errors
    const monthMap: Record<string, string> = {
      'jan': '01', 'january': '01', 'jen': '01', 'jap': '01',
      'feb': '02', 'february': '02', 'fep': '02', 'feh': '02',
      'mar': '03', 'march': '03', 'mer': '03',
      'apr': '04', 'april': '04', 'epr': '04',
      'may': '05',
      'jun': '06', 'june': '06', 'jup': '06', 'jue': '06',
      'jul': '07', 'july': '07', 'jui': '07',
      'aug': '08', 'august': '08', 'eug': '08',
      'sep': '09', 'september': '09', 'sap': '09',
      'oct': '10', 'october': '10', 'oot': '10', 'ost': '10',
      'nov': '11', 'november': '11', 'nop': '11',
      'dec': '12', 'december': '12', 'des': '12', 'deo': '12', 'dea': '12'
    };
    
    // PRIORITY 1: Find "validity" section and extract date after "to"
    // This targets the specific format: "VALIDITY 01-jan-2025 to 05-dec-2025"
    const validityToPatterns = [
      // Match "validity ... to DD-MMM-YYYY" with various separators
      /validity[:\s]+.*?to[:\s]+(\d{1,2})[-\/.\s]([a-z]{3,9})[-\/.\s](\d{2,4})/i,
      // Match "to DD-MMM-YYYY" after any "from" or start date
      /(?:from|validity)[:\s]+\d{1,2}[-\/.\s][a-z]{3,9}[-\/.\s]\d{2,4}[:\s]+to[:\s]+(\d{1,2})[-\/.\s]([a-z]{3,9})[-\/.\s](\d{2,4})/i,
      // Simpler: just look for "to DD-MMM-YYYY" pattern
      /\bto[:\s]+(\d{1,2})[-\/.\s]([a-z]{3,9})[-\/.\s](\d{2,4})/i,
    ];
    
    for (const pattern of validityToPatterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        const day = match[1].padStart(2, '0');
        const monthStr = match[2].toLowerCase().substring(0, 3);
        let year = match[3];
        
        // Handle 2-digit years
        if (year.length === 2) {
          year = '20' + year;
        }
        
        const month = monthMap[monthStr];
        if (month) {
          console.log(`✅ Found date after "to" in validity section: ${day}-${monthStr}-${year} -> ${year}-${month}-${day}`);
          return `${year}-${month}-${day}`;
        }
      }
    }
    
    // PRIORITY 2: Look for "valid to" or "valid till" patterns
    const validToPatterns = [
      /valid\s*(?:to|till|until)[:\s]+(\d{1,2})[-\/.\s]([a-z]{3,9})[-\/.\s](\d{2,4})/i,
    ];
    
    for (const pattern of validToPatterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        const day = match[1].padStart(2, '0');
        const monthStr = match[2].toLowerCase().substring(0, 3);
        let year = match[3];
        
        if (year.length === 2) {
          year = '20' + year;
        }
        
        const month = monthMap[monthStr];
        if (month) {
          console.log(`✅ Found in valid to/till section: ${day}-${monthStr}-${year} -> ${year}-${month}-${day}`);
          return `${year}-${month}-${day}`;
        }
      }
    }
    
    // PRIORITY 3: Look for expiry/expire keywords
    const expiryPatterns = [
      /expir(?:y|es?|ing)[:\s]+(\d{1,2})[-\/.\s]([a-z]{3,9})[-\/.\s](\d{2,4})/i,
      /exp[:\s]+(\d{1,2})[-\/.\s]([a-z]{3,9})[-\/.\s](\d{2,4})/i,
    ];
    
    for (const pattern of expiryPatterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        const day = match[1].padStart(2, '0');
        const monthStr = match[2].toLowerCase().substring(0, 3);
        let year = match[3];
        
        if (year.length === 2) {
          year = '20' + year;
        }
        
        const month = monthMap[monthStr];
        if (month) {
          console.log(`Found in expiry section: ${day}-${monthStr}-${year} -> ${year}-${month}-${day}`);
          return `${year}-${month}-${day}`;
        }
      }
    }
    
    // PRIORITY 4: Fallback - find all dates and return the last one (likely expiry)
    const datePatterns = [
      /(\d{1,2})[-\/]([a-z]{3,9})[-\/](\d{2,4})/gi,
      /(\d{1,2})[.]([a-z]{3,9})[.](\d{2,4})/gi,
      /(\d{1,2})\s+([a-z]{3,9})\s+(\d{2,4})/gi,
    ];
    
    const allMatches: Array<{day: string, month: string, year: string}> = [];
    
    for (const pattern of datePatterns) {
      let match;
      while ((match = pattern.exec(normalizedText)) !== null) {
        const day = match[1].padStart(2, '0');
        const monthStr = match[2].toLowerCase().substring(0, 3);
        let year = match[3];
        
        if (year.length === 2) {
          year = '20' + year;
        }
        
        const month = monthMap[monthStr];
        if (month) {
          allMatches.push({ day, month, year });
        }
      }
    }
    
    // Return the last valid date found (typically expiry is last)
    if (allMatches.length > 0) {
      const lastMatch = allMatches[allMatches.length - 1];
      console.log(`⚠️ Fallback found date: ${lastMatch.year}-${lastMatch.month}-${lastMatch.day}`);
      return `${lastMatch.year}-${lastMatch.month}-${lastMatch.day}`;
    }
    
    console.log('❌ No date found in text');
    return null;
  };

  const extractPassIdFromText = (text: string): string | null => {
    console.log('Extracting Pass ID from:', text);
    
    // Normalize text for better matching
    let normalizedText = text
      .replace(/[|!]/g, 'i')
      .replace(/[o]/gi, '0')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log('Normalized text for ID:', normalizedText);
    
    // Enhanced patterns with multiple variations
    const idPatterns = [
      // Explicit ID labels
      /(?:pass\s*id|passid|p\.?\s*id|pid|bus\s*pass\s*id)[\s:=]*([A-Z0-9]{4,15})/i,
      /(?:id\s*no|id\s*number|identification)[\s:=]*([A-Z0-9]{4,15})/i,
      /(?:^|\s)id[\s:=]*([A-Z0-9]{4,15})/i,
      
      // State-prefix patterns (e.g., AP123456, TS987654)
      /\b([A-Z]{2}\d{6,10})\b/,
      /\b([A-Z]{2}[-\s]?\d{6,10})\b/,
      
      // Mixed alphanumeric (e.g., ABC12345, X1Y2Z3)
      /\b([A-Z]{2,4}\d{4,8})\b/,
      /\b([A-Z]\d[A-Z]\d{4,7})\b/,
      
      // Pure numeric IDs (6-12 digits)
      /\b(\d{8,12})\b/,
      /\b(\d{6,7})\b/,
      
      // Hyphenated or spaced formats
      /\b([A-Z0-9]{2,4}[-\s][A-Z0-9]{4,8})\b/,
    ];

    for (const pattern of idPatterns) {
      const match = normalizedText.match(pattern);
      if (match && match[1]) {
        const passId = match[1].trim().replace(/[-\s]/g, '').toUpperCase();
        
        // Validate: must be at least 4 characters
        if (passId.length >= 4) {
          const numericPortion = passId.replace(/\D/g, '');
          console.log(`✅ Found Pass ID: ${passId} (numeric portion: ${numericPortion})`);
          return passId;
        }
      }
    }
    
    console.log('❌ No Pass ID found in text');
    return null;
  };

  const runOCR = async (file: File) => {
    setOcrProgress(0);
    
    toast({
      title: "Preprocessing image...",
      description: "This may take 10-15 seconds"
    });

    // Preprocess image (give UI time to update)
    await new Promise(resolve => setTimeout(resolve, 50));
    const preprocessedBlob = await preprocessImage(file);
    
    // Give UI time to breathe
    await new Promise(resolve => setTimeout(resolve, 50));
    
    toast({
      title: "Running OCR...",
      description: "Extracting text from pass"
    });

    const { data: { text } } = await Tesseract.recognize(
      preprocessedBlob,
      'eng',
      {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const progress = Math.round(m.progress * 100);
            setOcrProgress(progress);
            
            // Update progress every 25%
            if (progress % 25 === 0) {
              toast({
                title: `OCR Progress: ${progress}%`,
                description: "Please wait...",
                duration: 2000
              });
            }
          }
        }
      }
    );
    
    console.log('OCR extracted text:', text);
    return text;
  };

  const handleMonthlyPassUpload = async () => {
    if (!user || !monthlyPassFile) {
      toast({
        title: "No file selected",
        description: "Please select a monthly pass to upload",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    setOcrProgress(0);

    try {
      toast({
        title: "Analyzing pass...",
        description: "Extracting expiry date and pass ID"
      });

      // Run OCR on the file (don't upload yet, wait for verification)
      setTimeout(async () => {
        try {
          const ocrText = await runOCR(monthlyPassFile);
          console.log('OCR Text:', ocrText);

          // Extract expiry date and pass ID
          const expiryDate = extractDateFromText(ocrText);
          const passId = extractPassIdFromText(ocrText);

          console.log('Extracted - Expiry:', expiryDate, 'Pass ID:', passId);

          // Set extracted values for user verification
          setExtractedExpiryDate(expiryDate || '');
          setExtractedPassId(passId || '');

          // Show verification dialog and enable button
          setShowVerificationDialog(true);
          setUploading(false);

          toast({
            title: "OCR Complete",
            description: "Please verify the extracted information",
          });
        } catch (ocrError: any) {
          console.error('OCR error:', ocrError);
          toast({
            title: "OCR failed",
            description: "Please enter pass details manually",
            variant: "destructive"
          });
          setExtractedExpiryDate('');
          setExtractedPassId('');
          setShowVerificationDialog(true);
          setUploading(false);
        }
      }, 100);

    } catch (error: any) {
      toast({
        title: "Processing failed",
        description: error.message,
        variant: "destructive"
      });
      setUploading(false);
    }
  };

  const handleVerificationConfirm = async () => {
    if (!user || !monthlyPassFile) return;

    setUploading(true);

    try {
      // Now upload the file after user verification
      const uploadResult = await uploadFile(monthlyPassFile, 'monthly_pass');
      if (!uploadResult) throw new Error('Upload failed');

      // Extract only numeric characters from pass ID for duplicate checking
      const numericPassId = extractedPassId ? extractedPassId.replace(/\D/g, '').trim() : '';
      console.log('Original Pass ID:', extractedPassId);
      console.log('Numeric Pass ID for comparison:', numericPassId);

      // Check for duplicate numeric pass IDs BEFORE saving
      let isDuplicate = false;
      const duplicatePassIds: string[] = [];
      
      if (numericPassId && numericPassId.length >= 4) {
        const { data: allPasses, error: queryError } = await supabase
          .from('passes')
          .select('id, user_id, buss_pass_id')
          .not('buss_pass_id', 'is', null);

        if (queryError) {
          console.error('Error querying passes:', queryError);
        } else {
          console.log('Total passes to check:', allPasses?.length || 0);
          
          allPasses?.forEach(existingPass => {
            if (existingPass.user_id === user.id) {
              console.log('Skipping own pass:', existingPass.buss_pass_id);
              return; // Skip current user's existing pass
            }
            
            const existingNumeric = (existingPass.buss_pass_id || '').replace(/\D/g, '').trim();
            console.log('Comparing with pass:', existingPass.buss_pass_id, '-> numeric:', existingNumeric);
            
            if (existingNumeric && existingNumeric === numericPassId && existingNumeric.length >= 4) {
              isDuplicate = true;
              duplicatePassIds.push(existingPass.id);
              console.log('🚨 DUPLICATE FOUND:', existingPass.buss_pass_id, 'matches', extractedPassId);
            }
          });
        }

        if (isDuplicate) {
          console.log('⚠️ Duplicate detected! Total duplicates:', duplicatePassIds.length);
          toast({
            title: "⚠️ Duplicate Pass ID Detected",
            description: `This numeric pass ID (${numericPassId}) already exists. Pass will be marked as FAKE.`,
            variant: "destructive",
            duration: 5000
          });
        }
      }

      // Save pass to database with correct verification status
      const passData: any = {
        user_id: user.id,
        monthly_pass_url: uploadResult.publicUrl,
        verified: !isDuplicate, // Mark as false if duplicate found
        buss_pass_id: extractedPassId || null,
        expiry_date: extractedExpiryDate || null
      };

      let currentPassId: string;
      
      if (pass) {
        await supabase
          .from('passes')
          .update(passData)
          .eq('id', pass.id);
        currentPassId = pass.id;
      } else {
        const { data: newPass } = await supabase
          .from('passes')
          .insert(passData)
          .select('id')
          .single();
        currentPassId = newPass?.id;
      }

      // Update profile with expiry date
      if (extractedExpiryDate) {
        await supabase
          .from('profiles')
          .update({ pass_expiry_date: extractedExpiryDate })
          .eq('id', user.id);
      }

      // If duplicates found, mark all duplicate passes as unverified
      if (isDuplicate && duplicatePassIds.length > 0) {
        console.log('Marking all duplicate passes as unverified...');
        
        // Mark all duplicate passes as unverified
        for (const duplicateId of duplicatePassIds) {
          await supabase
            .from('passes')
            .update({ verified: false })
            .eq('id', duplicateId);
          console.log('Marked pass as unverified:', duplicateId);
        }

        // Notify admins
        const { data: admins } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');

        if (admins && admins.length > 0) {
          console.log('Notifying admins about duplicate...');
          const alertPromises = admins.map(admin =>
            supabase.from('alerts').insert({
              user_id: admin.user_id,
              type: 'duplicate_pass',
              status: 'pending',
              message: `🚨 FAKE PASS DETECTED: Duplicate numeric ID ${numericPassId} found. Pass IDs involved: ${[extractedPassId, ...duplicatePassIds.map(id => `ID:${id}`)].join(', ')}. Immediate investigation required.`,
              send_at: new Date().toISOString()
            })
          );
          await Promise.all(alertPromises);
          console.log('Admin alerts sent successfully');
        }
      }

      toast({
        title: "Success",
        description: isDuplicate 
          ? "Pass uploaded but marked as FAKE due to duplicate numeric ID" 
          : "Monthly pass saved successfully"
      });

      setShowVerificationDialog(false);
      setMonthlyPassFile(null);
      setExtractedPassId('');
      setExtractedExpiryDate('');
      
      // Force refresh pass data
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay to ensure DB is updated
      await fetchPass();
      
    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteIdentityCard = async () => {
    if (!user || !pass) return;

    if (!confirm('Are you sure you want to delete your identity card?')) {
      return;
    }

    setDeletingIdentity(true);

    try {
      // Delete storage file
      await supabase.storage
        .from('pass-documents')
        .remove([`${user.id}/identity_card.png`]);

      // Update database record
      const { error } = await supabase
        .from('passes')
        .update({ identity_card_url: null })
        .eq('id', pass.id);

      if (error) throw error;

      toast({
        title: "Identity card deleted",
        description: "Your identity card has been removed successfully"
      });

      await fetchPass();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setDeletingIdentity(false);
    }
  };

  const handleDeleteMonthlyPass = async () => {
    if (!user || !pass) return;

    if (!confirm('Are you sure you want to delete your monthly pass?')) {
      return;
    }

    setDeletingMonthly(true);

    try {
      // Delete storage file
      await supabase.storage
        .from('pass-documents')
        .remove([`${user.id}/monthly_pass.png`]);

      // Update database record
      const { error } = await supabase
        .from('passes')
        .update({ 
          monthly_pass_url: null,
          buss_pass_id: null,
          expiry_date: null 
        })
        .eq('id', pass.id);

      if (error) throw error;

      // Also clear pass_expiry_date from profile
      await supabase
        .from('profiles')
        .update({ pass_expiry_date: null })
        .eq('id', user.id);

      toast({
        title: "Monthly pass deleted",
        description: "Your monthly pass has been removed successfully"
      });

      await fetchPass();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setDeletingMonthly(false);
    }
  };

  // Images persist until replaced with new uploads - delete functionality removed

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-lg text-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-mesh">
      <div className="relative overflow-hidden border-b border-border/30 glass">
        <div className="absolute inset-0 bg-gradient-accent opacity-10" />
        <div className="relative max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/dashboard')} 
              className="hover:bg-primary/10 border-primary/30"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <Button 
              variant="ghost" 
              onClick={handleRefresh}
              disabled={refreshing}
              className="hover:bg-primary/10 border-primary/30"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold font-display text-foreground">E-Pass Management</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {!feeStatus && (
          <Card className="glass border-destructive/50 shadow-lg mb-6 animate-slide-up">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="h-6 w-6" />
                <div>
                  <p className="font-bold text-lg">Monthly Fee Not Paid</p>
                  <p className="text-sm text-muted-foreground">You must pay your monthly fee before uploading or viewing pass documents.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        <Card className={`glass border-border/50 shadow-lg hover:shadow-glow transition-all animate-slide-up ${!feeStatus ? 'opacity-50 pointer-events-none' : ''}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <CreditCard className="h-5 w-5 text-primary" />
              Your E-Pass
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Upload Section */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="identity-card" className="text-foreground font-semibold">IDENTITY CARD</Label>
                  <div className="flex gap-2">
                    <Input
                      id="identity-card"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setIdentityCardFile(e.target.files?.[0] || null)}
                      disabled={uploading}
                      className="bg-muted/30 border-border/50 text-foreground flex-1"
                    />
                    <Button 
                      onClick={handleIdentityCardUpload} 
                      disabled={uploading || !identityCardFile}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                  </div>
                  {pass?.identity_card_url && (
                    <div className="mt-2 space-y-2">
                      <div 
                        className="relative group cursor-pointer overflow-hidden rounded-lg border border-border/50 shadow-md hover:shadow-glow transition-all"
                        onClick={() => openImageModal(pass.identity_card_url, 'Identity Card')}
                      >
                        <img 
                          src={pass.identity_card_url} 
                          alt="Identity Card" 
                          className="max-w-full h-auto transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                          <Maximize2 className="h-12 w-12 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Click to view full size</p>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDeleteIdentityCard}
                          disabled={deletingIdentity}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          {deletingIdentity ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="monthly-pass" className="text-foreground font-semibold">MONTHLY PASS</Label>
                  
                  {/* Show alert if user has active pass */}
                  {pass?.monthly_pass_url && pass?.expiry_date && 
                   new Date(pass.expiry_date) >= new Date() && 
                   pass.verified !== false && (
                    <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-semibold text-foreground">Active Pass Detected</p>
                        <p className="text-muted-foreground">
                          You have an active pass valid until{" "}
                          <span className="font-semibold text-foreground">
                            {new Date(pass.expiry_date).toLocaleDateString('en-US', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                          . You can upload a new pass after it expires.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Input
                      id="monthly-pass"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setMonthlyPassFile(e.target.files?.[0] || null)}
                      disabled={uploading || (pass?.monthly_pass_url && pass?.expiry_date && 
                        new Date(pass.expiry_date) >= new Date() && 
                        pass.verified !== false)}
                      className="bg-muted/30 border-border/50 text-foreground flex-1"
                    />
                    <Button 
                      onClick={handleMonthlyPassUpload} 
                      disabled={uploading || !monthlyPassFile || 
                        (pass?.monthly_pass_url && pass?.expiry_date && 
                          new Date(pass.expiry_date) >= new Date() && 
                          pass.verified !== false)}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                  </div>
                  {pass?.monthly_pass_url && (
                    <div className="mt-2 space-y-3">
                      <div 
                        className="relative group cursor-pointer overflow-hidden rounded-lg border border-border/50 shadow-md hover:shadow-glow transition-all"
                        onClick={() => openImageModal(`${pass.monthly_pass_url}?t=${new Date().getTime()}`, 'Monthly Pass')}
                      >
                        <img 
                          src={`${pass.monthly_pass_url}?t=${new Date().getTime()}`} 
                          alt="Monthly Pass" 
                          className="max-w-full h-auto transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center pointer-events-none">
                          <Maximize2 className="h-12 w-12 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                        </div>
                        {/* FAKE PASS takes priority over EXPIRED */}
                        {pass.verified === false ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg backdrop-blur-sm pointer-events-none">
                            <div className="text-center">
                              <p className="text-red-500 text-4xl font-bold font-display animate-pulse drop-shadow-lg">
                                FAKE PASS
                              </p>
                              <p className="text-white text-lg mt-2 font-semibold">
                                ⚠️ DUPLICATE NUMERIC ID DETECTED
                              </p>
                              <p className="text-white text-sm mt-1">
                                Contact admin immediately
                              </p>
                            </div>
                          </div>
                        ) : pass.expiry_date && new Date(pass.expiry_date) < new Date() ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg backdrop-blur-sm pointer-events-none">
                            <div className="text-center">
                              <p className="text-red-500 text-4xl font-bold font-display animate-pulse drop-shadow-lg">
                                PASS EXPIRED
                              </p>
                              <p className="text-white text-lg mt-2 font-semibold">
                                Expired on: {new Date(pass.expiry_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Click to view full size</p>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDeleteMonthlyPass}
                          disabled={deletingMonthly || (pass?.expiry_date && 
                            new Date(pass.expiry_date) >= new Date() && 
                            pass.verified !== false)}
                          title={pass?.expiry_date && new Date(pass.expiry_date) >= new Date() && pass.verified !== false 
                            ? "Cannot delete active pass. Wait until expiry." 
                            : ""}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          {deletingMonthly ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                      {pass.verified === false ? (
                        <div className="text-center">
                          <p className="text-red-500 text-2xl font-bold font-display animate-pulse drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
                            ⚠️ FAKE PASS - DUPLICATE ID DETECTED
                          </p>
                          <p className="text-red-400 text-sm mt-1">
                            Contact admin immediately
                          </p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-green-400 text-2xl font-bold font-display drop-shadow-[0_0_10px_rgba(74,222,128,0.8)]">
                            ✓ VERIFIED
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Pass Info Section */}
              {pass && (
                <div className="space-y-4 pt-4 border-t border-border/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pass.buss_pass_id && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Bus Pass ID</p>
                        <p className="font-medium text-foreground">{pass.buss_pass_id}</p>
                      </div>
                    )}
                    {pass.expiry_date && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Expiry Date</p>
                        <p className="font-medium text-foreground">{new Date(pass.expiry_date).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Verification Dialog */}
      <Dialog open={showVerificationDialog} onOpenChange={setShowVerificationDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Verify Extracted Data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Please verify and correct the information extracted from your pass:
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="verify-pass-id">Pass ID</Label>
              <Input
                id="verify-pass-id"
                value={extractedPassId}
                onChange={(e) => setExtractedPassId(e.target.value)}
                placeholder="Enter pass ID if not detected"
                className="bg-muted/30 border-border/50"
              />
              {!extractedPassId && (
                <p className="text-xs text-amber-500">⚠️ Pass ID not detected - please enter manually</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="verify-expiry">Expiry Date (YYYY-MM-DD)</Label>
              <Input
                id="verify-expiry"
                type="date"
                value={extractedExpiryDate}
                onChange={(e) => setExtractedExpiryDate(e.target.value)}
                className="bg-muted/30 border-border/50"
              />
              {!extractedExpiryDate && (
                <p className="text-xs text-amber-500">⚠️ Expiry date not detected - please select manually</p>
              )}
            </div>

            {ocrProgress > 0 && ocrProgress < 100 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Processing: {ocrProgress}%</p>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${ocrProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowVerificationDialog(false);
                  setUploading(false);
                  setMonthlyPassFile(null);
                  setExtractedPassId('');
                  setExtractedExpiryDate('');
                }}
                className="flex-1"
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleVerificationConfirm}
                disabled={uploading}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                <Check className="h-4 w-4 mr-2" />
                {uploading ? "Saving..." : "Confirm & Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Zoom Modal */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && closeImageModal()}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden">
          <DialogHeader className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
            <DialogTitle className="text-white font-display flex items-center justify-between">
              <span>{selectedImage?.title}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeImageModal}
                className="text-white hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="relative w-full h-[85vh] flex items-center justify-center bg-black/95 overflow-auto">
            {selectedImage && (
              <img
                src={selectedImage.url}
                alt={selectedImage.title}
                className="max-w-none transition-transform duration-300"
                style={{ transform: `scale(${imageZoom})` }}
              />
            )}
          </div>

          {/* Zoom Controls */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2 bg-black/80 backdrop-blur-sm rounded-full p-2 shadow-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              disabled={imageZoom <= 0.5}
              className="text-white hover:bg-white/20 rounded-full h-10 w-10 p-0"
            >
              <ZoomOut className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetZoom}
              className="text-white hover:bg-white/20 rounded-full px-4"
            >
              {Math.round(imageZoom * 100)}%
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              disabled={imageZoom >= 3}
              className="text-white hover:bg-white/20 rounded-full h-10 w-10 p-0"
            >
              <ZoomIn className="h-5 w-5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EPass;
