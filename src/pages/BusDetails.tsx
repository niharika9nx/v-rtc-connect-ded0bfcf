import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Bus, Clock, MapPin, IndianRupee, Calendar } from 'lucide-react';
import { formatTo12Hour } from '@/lib/utils';

const BusDetails = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [busDetails, setBusDetails] = useState<any>(null);
  const [feeStatus, setFeeStatus] = useState<any>(null);
  const [passData, setPassData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();

      // Set up real-time subscription for fee_history updates
      const channel = supabase
        .channel('fee-history-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'fee_history',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            fetchData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    
    setProfile(profileData);

    if (profileData?.bus_number) {
      // Fetch bus details
      const { data: busData } = await supabase
        .from('bus_details')
        .select('*')
        .eq('bus_number', profileData.bus_number)
        .maybeSingle();
      
      setBusDetails(busData);

      // Fetch pass data
      const { data: passInfo } = await supabase
        .from('passes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      setPassData(passInfo);

      // Fetch current month fee status
      const currentMonth = new Date().toLocaleString('default', { month: 'long' });
      const currentYear = new Date().getFullYear();
      
      const { data: feeData } = await supabase
        .from('fee_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle();
      
      setFeeStatus(feeData);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-lg font-display text-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-mesh">
      <div className="border-b border-border/30 glass sticky top-0 z-50 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-secondary opacity-10" />
        <div className="relative max-w-7xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-2 hover:bg-primary/10 border-primary/30">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-display font-bold text-foreground">Bus Details</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {!profile?.bus_number ? (
          <Card className="glass shadow-lg animate-slide-up">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Bus className="h-20 w-20 mx-auto mb-4 text-primary animate-float" />
                <p className="text-lg font-display font-medium mb-2">No Bus Assigned</p>
                <p className="text-muted-foreground">You haven't been assigned to a bus yet. Please contact the admin.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="glass shadow-lg animate-slide-up hover:shadow-glow transition-all">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 font-display">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Bus className="h-6 w-6 text-primary" />
                  </div>
                  Bus Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 rounded-lg bg-gradient-primary/5 border border-primary/10">
                    <p className="text-sm text-muted-foreground mb-1">Bus Number</p>
                    <p className="text-3xl font-bold font-display bg-gradient-primary bg-clip-text text-transparent">
                      {profile.bus_number}
                    </p>
                  </div>
                  {busDetails?.route && (
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
                        <MapPin className="h-4 w-4 text-accent" />
                        Route
                      </p>
                      <p className="font-medium text-lg">{busDetails.route}</p>
                    </div>
                  )}
                  {busDetails?.departure_time && (
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
                        <Clock className="h-4 w-4 text-secondary" />
                        Departure Time
                      </p>
                      <p className="font-medium text-lg">{formatTo12Hour(busDetails.departure_time)}</p>
                    </div>
                  )}
                  {busDetails?.arrival_time && (
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
                        <Clock className="h-4 w-4 text-secondary" />
                        Arrival Time
                      </p>
                      <p className="font-medium text-lg">{formatTo12Hour(busDetails.arrival_time)}</p>
                    </div>
                  )}
                  {busDetails?.capacity && (
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground mb-1">Bus Capacity</p>
                      <p className="font-medium text-lg">{busDetails.capacity} seats</p>
                    </div>
                  )}
                  {passData?.buss_pass_id && (
                    <div className="p-4 rounded-lg bg-gradient-primary/5 border border-primary/10">
                      <p className="text-sm text-muted-foreground mb-1">Bus Pass ID</p>
                      <p className="font-bold text-xl font-display text-primary">{passData.buss_pass_id}</p>
                    </div>
                  )}
                  {profile?.seat_number !== null && profile?.seat_number !== undefined && (
                    <div className="p-4 rounded-lg bg-gradient-accent/5 border border-accent/10">
                      <p className="text-sm text-muted-foreground mb-1">Your Seat Number</p>
                      <p className="font-bold text-2xl font-display text-accent">{profile.seat_number}</p>
                    </div>
                  )}
                  {(passData?.expiry_date || profile?.pass_expiry_date) && (
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
                        <Calendar className="h-4 w-4 text-primary" />
                        Pass Expiry Date
                      </p>
                      <p className="font-medium text-lg">
                        {new Date(passData?.expiry_date || profile?.pass_expiry_date).toLocaleDateString()}
                      </p>
                      {new Date(passData?.expiry_date || profile?.pass_expiry_date) < new Date() && (
                        <Badge variant="destructive" className="mt-2">Expired</Badge>
                      )}
                    </div>
                  )}
                  {passData && (
                    <div className="p-4 rounded-lg bg-muted/50 md:col-span-2">
                      <p className="text-sm text-muted-foreground mb-2">Pass Verification Status</p>
                      {passData.verified === false ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive" className="text-sm px-4 py-2 animate-pulse">
                            ⚠️ UNVERIFIED - Duplicate Pass ID
                          </Badge>
                          <p className="text-sm text-destructive">Please contact admin immediately</p>
                        </div>
                      ) : (
                        <Badge className="text-sm px-4 py-2 bg-green-500 hover:bg-green-600">
                          ✓ VERIFIED
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="glass shadow-lg animate-slide-up hover:shadow-glow transition-all" style={{ animationDelay: '0.1s' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 font-display">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <IndianRupee className="h-6 w-6 text-accent" />
                  </div>
                  Monthly Fee Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
                      <Calendar className="h-4 w-4" />
                      Current Month
                    </p>
                    <p className="font-medium text-lg">
                      {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-2">Payment Status</p>
                    {feeStatus ? (
                      <Badge 
                        variant={feeStatus.status === 'paid' ? 'default' : 'destructive'}
                        className={`text-sm px-4 py-1 ${
                          feeStatus.status === 'paid' 
                            ? 'bg-gradient-primary shadow-glow' 
                            : 'bg-gradient-accent'
                        }`}
                      >
                        {feeStatus.status === 'paid' ? '✓ Paid' : '⚠ Due'}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-sm px-4 py-1">
                        No record
                      </Badge>
                    )}
                  </div>
                  {feeStatus?.amount && (
                    <div className="p-4 rounded-lg bg-gradient-primary/5 border border-primary/10 md:col-span-2">
                      <p className="text-sm text-muted-foreground mb-1">Amount</p>
                      <p className="font-bold text-2xl font-display flex items-center gap-1 text-primary">
                        <IndianRupee className="h-5 w-5" />
                        {feeStatus.amount}
                      </p>
                    </div>
                  )}
                </div>
                {!feeStatus && (
                  <div className="mt-4 p-4 rounded-lg bg-muted/30 border border-border">
                    <p className="text-sm text-muted-foreground text-center">
                      No fee record found for this month. Payment status will appear once updated by admin.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default BusDetails;
