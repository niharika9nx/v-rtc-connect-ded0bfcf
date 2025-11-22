import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, CreditCard, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AlertNotifications } from '@/components/AlertNotifications';

const EPass = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pass, setPass] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [identityCardFile, setIdentityCardFile] = useState<File | null>(null);
  const [monthlyPassFile, setMonthlyPassFile] = useState<File | null>(null);

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

  const uploadFile = async (file: File, type: 'identity_card' | 'monthly_pass') => {
    if (!user) return null;

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

    try {
      const uploadResult = await uploadFile(monthlyPassFile, 'monthly_pass');
      
      if (!uploadResult) throw new Error('Upload failed');

      toast({
        title: "Processing pass...",
        description: "Enhancing image and detecting expiry date"
      });
      
      try {
        const { data: enhanceData, error: enhanceError } = await supabase.functions.invoke('enhance-pass', {
          body: { filePath: uploadResult.filePath, userId: user.id }
        });

        if (enhanceError) {
          console.error('Enhancement error:', enhanceError);
          toast({
            title: "Processing warning",
            description: "Pass uploaded but enhancement failed. You may need to manually verify the expiry date.",
            variant: "destructive"
          });
        } else if (enhanceData?.success) {
          toast({
            title: "Pass processed!",
            description: enhanceData.expiryDate 
              ? `Expiry date detected: ${new Date(enhanceData.expiryDate).toLocaleDateString()}${enhanceData.isExpired ? ' (EXPIRED)' : ''}` 
              : "Enhancement complete",
          });
        }
      } catch (error: any) {
        console.error('Enhancement error:', error);
        toast({
          title: "Processing warning",
          description: "Pass uploaded but enhancement failed",
          variant: "destructive"
        });
      }

      const passData = {
        user_id: user.id,
        monthly_pass_url: uploadResult.publicUrl
      };

      if (pass) {
        await supabase
          .from('passes')
          .update({ monthly_pass_url: uploadResult.publicUrl })
          .eq('id', pass.id);
      } else {
        await supabase
          .from('passes')
          .insert(passData);
      }

      toast({
        title: "Success",
        description: "Monthly pass uploaded successfully"
      });

      setMonthlyPassFile(null);
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

  const handleDeletePass = async (type: 'identity_card' | 'monthly_pass') => {
    if (!user || !pass) return;

    setUploading(true);

    try {
      const filePath = type === 'identity_card' 
        ? pass.identity_card_url?.split('/').slice(-2).join('/')
        : pass.monthly_pass_url?.split('/').slice(-2).join('/');

      if (filePath) {
        // Delete from storage
        const { error: deleteError } = await supabase.storage
          .from('pass-documents')
          .remove([filePath]);

        if (deleteError) {
          console.error('Storage delete error:', deleteError);
        }
      }

      // Update database
      const updateData = type === 'identity_card'
        ? { identity_card_url: null }
        : { monthly_pass_url: null, expiry_date: null };

      const { error: updateError } = await supabase
        .from('passes')
        .update(updateData)
        .eq('id', pass.id);

      if (updateError) throw updateError;

      // If monthly pass deleted, also clear expiry date from profiles
      if (type === 'monthly_pass') {
        await supabase
          .from('profiles')
          .update({ pass_expiry_date: null })
          .eq('id', user.id);
      }

      toast({
        title: "Success",
        description: `${type === 'identity_card' ? 'Identity card' : 'Monthly pass'} deleted successfully`
      });

      fetchPass();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

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
          <Button 
            variant="ghost" 
            onClick={() => navigate('/dashboard')} 
            className="mb-2 hover:bg-primary/10 border-primary/30"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
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
                    <div className="mt-2 relative group">
                      <img 
                        src={pass.identity_card_url} 
                        alt="Identity Card" 
                        className="max-w-full h-auto rounded-lg border border-border/50 shadow-md"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeletePass('identity_card')}
                        disabled={uploading}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Delete
                      </Button>
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
                    <div className="mt-2 relative group">
                      <img 
                        src={pass.monthly_pass_url} 
                        alt="Monthly Pass" 
                        className="max-w-full h-auto rounded-lg border border-border/50 shadow-md"
                      />
                      {pass.expiry_date && new Date(pass.expiry_date) < new Date() && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg backdrop-blur-sm">
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
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeletePass('monthly_pass')}
                        disabled={uploading}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        Delete
                      </Button>
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
    </div>
  );
};

export default EPass;
