import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, CreditCard, Upload, RefreshCw, ZoomIn, ZoomOut, Maximize2, X, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AlertNotifications } from '@/components/AlertNotifications';
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

  useEffect(() => {
    fetchPass();
  }, [user]);

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

  const uploadFile = async (file: File, type: 'identity_card' | 'monthly_pass') => {
    if (!user) return null;

    // Clean up old files before uploading new one
    await cleanupOldFiles(type);

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${type}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage
      .from('pass-documents')
      .upload(filePath, file, { upsert: true });

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
        // Set canvas to image dimensions (scale to optimal DPI)
        const scaleFactor = 2; // 2x for better OCR
        canvas.width = img.width * scaleFactor;
        canvas.height = img.height * scaleFactor;

        // Draw image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Get image data for processing
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // 1. Grayscale conversion + Contrast enhancement
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          
          // Increase contrast (1.5x)
          const enhanced = Math.min(255, Math.max(0, (gray - 128) * 1.5 + 128));
          
          data[i] = enhanced;
          data[i + 1] = enhanced;
          data[i + 2] = enhanced;
        }

        // 2. Binarization (Otsu's method approximation)
        let threshold = 128;
        const histogram = new Array(256).fill(0);
        
        // Calculate histogram
        for (let i = 0; i < data.length; i += 4) {
          histogram[data[i]]++;
        }
        
        // Find optimal threshold
        let sum = 0;
        for (let i = 0; i < 256; i++) sum += i * histogram[i];
        
        let sumB = 0;
        let wB = 0;
        let wF = 0;
        let varMax = 0;
        const total = canvas.width * canvas.height;
        
        for (let t = 0; t < 256; t++) {
          wB += histogram[t];
          if (wB === 0) continue;
          
          wF = total - wB;
          if (wF === 0) break;
          
          sumB += t * histogram[t];
          const mB = sumB / wB;
          const mF = (sum - sumB) / wF;
          const varBetween = wB * wF * (mB - mF) * (mB - mF);
          
          if (varBetween > varMax) {
            varMax = varBetween;
            threshold = t;
          }
        }

        // Apply threshold
        for (let i = 0; i < data.length; i += 4) {
          const value = data[i] > threshold ? 255 : 0;
          data[i] = value;
          data[i + 1] = value;
          data[i + 2] = value;
        }

        // 3. Noise removal (median filter 3x3)
        const filtered = new Uint8ClampedArray(data);
        for (let y = 1; y < canvas.height - 1; y++) {
          for (let x = 1; x < canvas.width - 1; x++) {
            const neighbors = [];
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const idx = ((y + dy) * canvas.width + (x + dx)) * 4;
                neighbors.push(data[idx]);
              }
            }
            neighbors.sort((a, b) => a - b);
            const median = neighbors[4];
            const idx = (y * canvas.width + x) * 4;
            filtered[idx] = median;
            filtered[idx + 1] = median;
            filtered[idx + 2] = median;
          }
        }

        // Put processed image back
        ctx.putImageData(new ImageData(filtered, canvas.width, canvas.height), 0, 0);

        // Convert to blob
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        }, 'image/png');
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const extractDateFromText = (text: string): string | null => {
    // Look for validity section and date after "to"
    const lines = text.toLowerCase().split('\n');
    let validityFound = false;
    
    const monthMap: { [key: string]: string } = {
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
      'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
      'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this line contains "validity"
      if (line.includes('validity') || line.includes('valid')) {
        validityFound = true;
      }

      // If we found validity section, look for "to" followed by date
      if (validityFound && line.includes('to')) {
        // Pattern: DD-MMM-YYYY (e.g., 03-sep-2025)
        const datePattern = /(\d{1,2})[-\s]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-\s]*(\d{4})/i;
        const match = line.match(datePattern);
        
        if (match) {
          const day = match[1].padStart(2, '0');
          const monthAbbr = match[2].toLowerCase().substring(0, 3);
          const year = match[3];
          const month = monthMap[monthAbbr];
          
          if (month) {
            console.log(`Found expiry date: ${day}-${monthAbbr}-${year} -> ${year}-${month}-${day}`);
            return `${year}-${month}-${day}`;
          }
        }
      }
    }

    // Fallback: Try to find any DD-MMM-YYYY pattern
    const fullText = text.toLowerCase();
    const datePattern = /(\d{1,2})[-\s]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-\s]*(\d{4})/gi;
    const matches = [...fullText.matchAll(datePattern)];
    
    // Return the last date found (usually expiry is at the end)
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const day = lastMatch[1].padStart(2, '0');
      const monthAbbr = lastMatch[2].toLowerCase().substring(0, 3);
      const year = lastMatch[3];
      const month = monthMap[monthAbbr];
      
      if (month) {
        console.log(`Fallback found date: ${day}-${monthAbbr}-${year} -> ${year}-${month}-${day}`);
        return `${year}-${month}-${day}`;
      }
    }
    
    return null;
  };

  const extractPassIdFromText = (text: string): string | null => {
    // Look for patterns like: ID: XXXXX, Pass ID: XXXXX, or standalone numbers
    const idPatterns = [
      /(?:ID|PASS\s*ID|P\.ID|PID)[\s:]*([A-Z0-9]+)/i,
      /\b([A-Z]{2,3}\d{4,8})\b/,  // e.g., AP123456
      /\b(\d{6,10})\b/  // Standalone 6-10 digit number
    ];

    for (const pattern of idPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return null;
  };

  const runOCR = async (file: File) => {
    setOcrProgress(0);
    
    toast({
      title: "Preprocessing image...",
      description: "Enhancing image quality for better OCR"
    });

    // Preprocess image
    const preprocessedBlob = await preprocessImage(file);
    
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
            setOcrProgress(Math.round(m.progress * 100));
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
      const uploadResult = await uploadFile(monthlyPassFile, 'monthly_pass');
      
      if (!uploadResult) throw new Error('Upload failed');

      toast({
        title: "Analyzing pass...",
        description: "Extracting expiry date and pass ID"
      });

      // Run OCR on the uploaded image
      const ocrText = await runOCR(monthlyPassFile);
      console.log('OCR Text:', ocrText);

      // Extract expiry date and pass ID
      const expiryDate = extractDateFromText(ocrText);
      const passId = extractPassIdFromText(ocrText);

      console.log('Extracted - Expiry:', expiryDate, 'Pass ID:', passId);

      // Set extracted values for user verification
      setExtractedExpiryDate(expiryDate || '');
      setExtractedPassId(passId || '');

      // Show verification dialog
      setShowVerificationDialog(true);

      toast({
        title: "OCR Complete",
        description: "Please verify the extracted information",
      });

    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
      setUploading(false);
    }
  };

  const handleVerificationConfirm = async () => {
    if (!user || !monthlyPassFile) return;

    try {
      const uploadResult = await uploadFile(monthlyPassFile, 'monthly_pass');
      if (!uploadResult) throw new Error('Upload failed');

      // Update database with verified information
      const passData: any = {
        user_id: user.id,
        monthly_pass_url: uploadResult.publicUrl
      };

      if (extractedPassId) passData.buss_pass_id = extractedPassId;
      if (extractedExpiryDate) passData.expiry_date = extractedExpiryDate;

      if (pass) {
        await supabase
          .from('passes')
          .update(passData)
          .eq('id', pass.id);
      } else {
        await supabase
          .from('passes')
          .insert(passData);
      }

      // Update profile with expiry date
      if (extractedExpiryDate) {
        await supabase
          .from('profiles')
          .update({ pass_expiry_date: extractedExpiryDate })
          .eq('id', user.id);
      }

      toast({
        title: "Success",
        description: "Monthly pass saved successfully"
      });

      setShowVerificationDialog(false);
      setMonthlyPassFile(null);
      setExtractedPassId('');
      setExtractedExpiryDate('');
      await fetchPass();
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
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
        <AlertNotifications />
        
        <Card className="glass border-border/50 shadow-lg hover:shadow-glow transition-all animate-slide-up">
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
                    <div className="mt-2">
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
                      <p className="text-xs text-muted-foreground text-center mt-2">Click to view full size</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="monthly-pass" className="text-foreground font-semibold">MONTHLY PASS</Label>
                  <div className="flex gap-2">
                    <Input
                      id="monthly-pass"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setMonthlyPassFile(e.target.files?.[0] || null)}
                      disabled={uploading}
                      className="bg-muted/30 border-border/50 text-foreground flex-1"
                    />
                    <Button 
                      onClick={handleMonthlyPassUpload} 
                      disabled={uploading || !monthlyPassFile}
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
                        {pass.expiry_date && new Date(pass.expiry_date) < new Date() && (
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
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground text-center">Click to view full size</p>
                      <div className="text-center">
                        {pass.verified === false ? (
                          <p className="text-red-500 text-2xl font-bold font-display animate-pulse drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
                            ⚠️ UNVERIFIED - DUPLICATE PASS ID DETECTED
                          </p>
                        ) : (
                          <p className="text-green-400 text-2xl font-bold font-display drop-shadow-[0_0_10px_rgba(74,222,128,0.8)]">
                            ✓ VERIFIED
                          </p>
                        )}
                      </div>
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
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleVerificationConfirm}
                disabled={uploading || (!extractedPassId && !extractedExpiryDate)}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                <Check className="h-4 w-4 mr-2" />
                Confirm & Save
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
