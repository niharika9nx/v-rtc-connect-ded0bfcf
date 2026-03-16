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
import heic2any from 'heic2any';

// Helper function to check if file is HEIC format
const isHeicFile = (file: File): boolean => {
  const extension = file.name.toLowerCase().split('.').pop();
  return extension === 'heic' || extension === 'heif' || file.type === 'image/heic' || file.type === 'image/heif';
};

// Yield to UI thread to prevent page freezing
const yieldToUI = (): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, 0));
};

// Convert HEIC file to JPEG with progress feedback (non-blocking)
const convertHeicToJpeg = async (
  file: File, 
  onProgress?: (status: string) => void
): Promise<File> => {
  if (!isHeicFile(file)) {
    return file;
  }
  
  console.log('Converting HEIC file to JPEG:', file.name);
  onProgress?.('Preparing HEIC conversion...');
  
  // Yield to let UI update before heavy operation
  await yieldToUI();
  
  try {
    onProgress?.('Converting HEIC to JPEG...');
    
    // Use lower quality for much faster conversion - server AI handles OCR fine
    const convertedBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.7
    });
    
    // Yield after heavy conversion
    await yieldToUI();
    
    // heic2any can return a single blob or array of blobs
    const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
    
    // Create a new file with .jpg extension
    const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
    const convertedFile = new File([blob], newFileName, { type: 'image/jpeg' });
    
    onProgress?.('HEIC conversion complete!');
    console.log('HEIC conversion successful, new size:', convertedFile.size);
    
    return convertedFile;
  } catch (error) {
    console.error('HEIC conversion error:', error);
    throw new Error('Failed to convert HEIC image. Please try uploading a JPEG or PNG image instead.');
  }
};

// Compute SHA-256 hash of a file for caching
const computeFileHash = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

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
  const [conversionStatus, setConversionStatus] = useState<string | null>(null);
  const [deletingIdentity, setDeletingIdentity] = useState(false);
  const [deletingMonthly, setDeletingMonthly] = useState(false);
  const [feeStatus, setFeeStatus] = useState<any>(null);
  const [identityCardSignedUrl, setIdentityCardSignedUrl] = useState<string | null>(null);
  const [monthlyPassSignedUrl, setMonthlyPassSignedUrl] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState<string | null>(null);
  const [pendingFileHash, setPendingFileHash] = useState<string | null>(null);
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
      
      // Fetch signed URLs for existing pass documents
      if (data) {
        await fetchSignedUrls(data);
      }
      
      setLoading(false);
    }
  };

  const fetchSignedUrls = async (passData: any) => {
    if (!user) return;
    
    try {
      // Fetch signed URL for identity card
      if (passData.identity_card_url) {
        const filePath = extractFilePath(passData.identity_card_url);
        if (filePath) {
          const signedUrl = await getSignedUrl(filePath);
          setIdentityCardSignedUrl(signedUrl);
        }
      }
      
      // Fetch signed URL for monthly pass
      if (passData.monthly_pass_url) {
        const filePath = extractFilePath(passData.monthly_pass_url);
        if (filePath) {
          const signedUrl = await getSignedUrl(filePath);
          setMonthlyPassSignedUrl(signedUrl);
        }
      }
    } catch (error) {
      console.error('Error fetching signed URLs:', error);
    }
  };

  const extractFilePath = (url: string): string | null => {
    if (!url) return null;
    // Check if it's already just a file path (no http)
    if (!url.startsWith('http')) {
      return url;
    }
    // Extract file path from public URL
    const match = url.match(/pass-documents\/(.+?)(\?|$)/);
    return match ? match[1] : null;
  };

  const getSignedUrl = async (filePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('get-signed-url', {
        body: { filePath }
      });
      
      if (error) {
        console.error('Error getting signed URL:', error);
        return null;
      }
      
      return data?.signedUrl || null;
    } catch (error) {
      console.error('Error invoking get-signed-url:', error);
      return null;
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

  // Lightweight image prep: only converts HEIC, no scaling/reprocessing
  const prepareFileForUpload = async (file: File): Promise<File> => {
    if (isHeicFile(file)) {
      setConversionStatus('Converting HEIC image...');
      const converted = await convertHeicToJpeg(file, (status) => {
        setConversionStatus(status);
      });
      setConversionStatus(null);
      return converted;
    }
    return file;
  };

  const uploadFile = async (file: File, type: 'identity_card' | 'monthly_pass') => {
    if (!user) return null;

    // Clean up old files before uploading new one
    await cleanupOldFiles(type);

    // Prepare file (HEIC conversion only, no heavy processing)
    const readyFile = await prepareFileForUpload(file);
    const ext = readyFile.type === 'image/png' ? 'png' : 'jpg';
    const uploadable = new File([readyFile], `${type}.${ext}`, { type: readyFile.type });

    const filePath = `${user.id}/${type}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('pass-documents')
      .upload(filePath, uploadable, { upsert: true });

    if (uploadError) throw uploadError;

    return { filePath };
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
        identity_card_url: uploadResult.filePath // Store file path instead of public URL
      };

      if (pass) {
        await supabase
          .from('passes')
          .update({ identity_card_url: uploadResult.filePath })
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
      setConversionStatus(null);
    }
  };

  // Note: Date and Pass ID extraction handled server-side by enhance-pass edge function

  // Note: Date and Pass ID extraction is now handled server-side by the enhance-pass edge function
  // using Gemini AI for faster and more accurate OCR

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
    setProcessingStep('Preparing image...');

    try {
      setProcessingStep('Uploading...');
      
      // Step 1: Upload directly (uploadFile handles HEIC conversion internally)
      const uploadResult = await uploadFile(monthlyPassFile, 'monthly_pass');
      if (!uploadResult) throw new Error('Upload failed');

      // Step 3: Save file path to DB immediately (so it's not lost)
      const initialPassData: any = {
        user_id: user.id,
        monthly_pass_url: uploadResult.filePath,
      };

      if (pass) {
        await supabase
          .from('passes')
          .update({ monthly_pass_url: uploadResult.filePath })
          .eq('id', pass.id);
      } else {
        await supabase
          .from('passes')
          .insert(initialPassData);
      }

      setProcessingStep('Extracting pass details with AI...');
      
      // Step 4: Call server-side OCR via edge function (uses Gemini AI - much faster)
      const { data: enhanceResult, error: enhanceError } = await supabase.functions.invoke('enhance-pass', {
        body: { filePath: uploadResult.filePath, userId: user.id }
      });

      if (enhanceError) {
        console.error('Enhance pass error:', enhanceError);
        // Still show verification dialog even if OCR fails
        setExtractedPassId('');
        setExtractedExpiryDate('');
        setShowVerificationDialog(true);
        toast({
          title: "OCR extraction failed",
          description: "Please enter pass details manually",
          variant: "destructive"
        });
      } else {
        console.log('Server OCR result:', enhanceResult);
        // Set extracted values from server response
        setExtractedPassId(enhanceResult?.passId || '');
        setExtractedExpiryDate(enhanceResult?.expiryDate || '');
        setShowVerificationDialog(true);
        
        toast({
          title: "Pass analyzed",
          description: "Please verify the extracted information",
        });
      }
      
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Processing failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setProcessingStep(null);
      setConversionStatus(null);
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

      // Save pass to database with correct verification status (store file path, not public URL)
      const passData: any = {
        user_id: user.id,
        monthly_pass_url: uploadResult.filePath,
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
      setConversionStatus(null);
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
                      accept="image/*,.heic,.heif"
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
                  
                  {/* Conversion status indicator for identity card */}
                  {conversionStatus && identityCardFile && (
                    <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/30 rounded-lg animate-pulse">
                      <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-foreground font-medium">{conversionStatus}</span>
                    </div>
                  )}
                  {pass?.identity_card_url && identityCardSignedUrl && (
                    <div className="mt-2 space-y-2">
                      <div 
                        className="relative group cursor-pointer overflow-hidden rounded-lg border border-border/50 shadow-md hover:shadow-glow transition-all"
                        onClick={() => openImageModal(identityCardSignedUrl, 'Identity Card')}
                      >
                        <img 
                          src={identityCardSignedUrl} 
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
                  {pass?.identity_card_url && !identityCardSignedUrl && (
                    <div className="mt-2 p-4 bg-muted/30 rounded-lg flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading image...</span>
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
                      accept="image/*,.heic,.heif"
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
                  
                  {/* Conversion status indicator for monthly pass */}
                  {conversionStatus && monthlyPassFile && (
                    <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/30 rounded-lg animate-pulse">
                      <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-foreground font-medium">{conversionStatus}</span>
                    </div>
                  )}
                  
                  {/* Processing step indicator */}
                  {processingStep && (
                    <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/30 rounded-lg">
                      <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-foreground font-medium">{processingStep}</span>
                    </div>
                  )}
                  {pass?.monthly_pass_url && monthlyPassSignedUrl && (
                    <div className="mt-2 space-y-3">
                      <div 
                        className="relative group cursor-pointer overflow-hidden rounded-lg border border-border/50 shadow-md hover:shadow-glow transition-all"
                        onClick={() => openImageModal(monthlyPassSignedUrl, 'Monthly Pass')}
                      >
                        <img 
                          src={monthlyPassSignedUrl} 
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
                  {pass?.monthly_pass_url && !monthlyPassSignedUrl && (
                    <div className="mt-2 p-4 bg-muted/30 rounded-lg flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading image...</span>
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

            {processingStep && (
              <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-md">
                <RefreshCw className="h-3 w-3 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">{processingStep}</p>
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
