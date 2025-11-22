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

    return publicUrl;
  };

  const handleUpload = async () => {
    if (!user) return;
    if (!identityCardFile && !monthlyPassFile) {
      toast({
        title: "No files selected",
        description: "Please select at least one file to upload",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      let identityCardUrl = pass?.identity_card_url;
      let monthlyPassUrl = pass?.monthly_pass_url;

      if (identityCardFile) {
        identityCardUrl = await uploadFile(identityCardFile, 'identity_card');
      }

      if (monthlyPassFile) {
        monthlyPassUrl = await uploadFile(monthlyPassFile, 'monthly_pass');
      }

      const passData = {
        user_id: user.id,
        identity_card_url: identityCardUrl,
        monthly_pass_url: monthlyPassUrl
      };

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

      toast({
        title: "Success",
        description: "Documents uploaded successfully"
      });

      setIdentityCardFile(null);
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
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identity-card" className="text-foreground font-semibold">IDENTITY CARD</Label>
                  <div className="flex gap-2">
                    <Input
                      id="identity-card"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setIdentityCardFile(e.target.files?.[0] || null)}
                      disabled={uploading}
                      className="bg-muted/30 border-border/50 text-foreground"
                    />
                  </div>
                  {pass?.identity_card_url && (
                    <div className="mt-2">
                      <img 
                        src={pass.identity_card_url} 
                        alt="Identity Card" 
                        className="max-w-full h-auto rounded-lg border border-border/50 shadow-md"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthly-pass" className="text-foreground font-semibold">MONTHLY PASS</Label>
                  <div className="flex gap-2">
                    <Input
                      id="monthly-pass"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setMonthlyPassFile(e.target.files?.[0] || null)}
                      disabled={uploading}
                      className="bg-muted/30 border-border/50 text-foreground"
                    />
                  </div>
                  {pass?.monthly_pass_url && (
                    <div className="mt-2">
                      <img 
                        src={pass.monthly_pass_url} 
                        alt="Monthly Pass" 
                        className="max-w-full h-auto rounded-lg border border-border/50 shadow-md"
                      />
                    </div>
                  )}
                </div>

                <Button 
                  onClick={handleUpload} 
                  disabled={uploading || (!identityCardFile && !monthlyPassFile)}
                  className="w-full bg-primary hover:bg-primary/90 hover:shadow-glow"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload Documents'}
                </Button>
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
