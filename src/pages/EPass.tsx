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
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">E-Pass Management</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Your E-Pass
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Upload Section */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identity-card">IDENTITY CARD</Label>
                  <div className="flex gap-2">
                    <Input
                      id="identity-card"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setIdentityCardFile(e.target.files?.[0] || null)}
                      disabled={uploading}
                    />
                  </div>
                  {pass?.identity_card_url && (
                    <div className="mt-2">
                      <img 
                        src={pass.identity_card_url} 
                        alt="Identity Card" 
                        className="max-w-full h-auto rounded-lg border"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthly-pass">MONTHLY PASS</Label>
                  <div className="flex gap-2">
                    <Input
                      id="monthly-pass"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setMonthlyPassFile(e.target.files?.[0] || null)}
                      disabled={uploading}
                    />
                  </div>
                  {pass?.monthly_pass_url && (
                    <div className="mt-2">
                      <img 
                        src={pass.monthly_pass_url} 
                        alt="Monthly Pass" 
                        className="max-w-full h-auto rounded-lg border"
                      />
                    </div>
                  )}
                </div>

                <Button 
                  onClick={handleUpload} 
                  disabled={uploading || (!identityCardFile && !monthlyPassFile)}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload Documents'}
                </Button>
              </div>

              {/* Pass Info Section */}
              {pass && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pass.buss_pass_id && (
                      <div>
                        <p className="text-sm text-muted-foreground">Bus Pass ID</p>
                        <p className="font-medium">{pass.buss_pass_id}</p>
                      </div>
                    )}
                    {pass.expiry_date && (
                      <div>
                        <p className="text-sm text-muted-foreground">Expiry Date</p>
                        <p className="font-medium">{new Date(pass.expiry_date).toLocaleDateString()}</p>
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
