import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CreditCard } from 'lucide-react';

const EPass = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pass, setPass] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      supabase
        .from('passes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          setPass(data);
          setLoading(false);
        });
    }
  }, [user]);

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
            {!pass ? (
              <div className="text-center py-8">
                <CreditCard className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">No E-Pass Found</p>
                <p className="text-muted-foreground mb-4">You haven't uploaded your pass documents yet.</p>
                <Button>Upload E-Pass Documents</Button>
              </div>
            ) : (
              <div className="space-y-4">
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
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Pass Documents</p>
                  <div className="space-y-2">
                    {pass.identity_card_url && (
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <span className="text-sm">Identity Card</span>
                        <Button size="sm" variant="outline">View</Button>
                      </div>
                    )}
                    {pass.monthly_pass_url && (
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <span className="text-sm">Monthly Pass</span>
                        <Button size="sm" variant="outline">View</Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EPass;
