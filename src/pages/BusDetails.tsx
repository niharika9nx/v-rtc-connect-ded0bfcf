import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Bus, Clock, MapPin } from 'lucide-react';

const BusDetails = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [busDetails, setBusDetails] = useState<any>(null);
  const [feeStatus, setFeeStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      // Fetch profile
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
        .then(async ({ data: profileData }) => {
          setProfile(profileData);

          if (profileData?.bus_number) {
            // Fetch bus details
            const { data: busData } = await supabase
              .from('bus_details')
              .select('*')
              .eq('bus_number', profileData.bus_number)
              .maybeSingle();
            
            setBusDetails(busData);

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
          <h1 className="text-2xl font-bold">Bus Details</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {!profile?.bus_number ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Bus className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">No Bus Assigned</p>
                <p className="text-muted-foreground">You haven't been assigned to a bus yet. Please contact the admin.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bus className="h-5 w-5" />
                  Bus Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Bus Number</p>
                    <p className="text-2xl font-bold">{profile.bus_number}</p>
                  </div>
                  {busDetails?.route && (
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        Route
                      </p>
                      <p className="font-medium">{busDetails.route}</p>
                    </div>
                  )}
                  {busDetails?.departure_time && (
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        Departure Time
                      </p>
                      <p className="font-medium">{busDetails.departure_time}</p>
                    </div>
                  )}
                  {busDetails?.arrival_time && (
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        Arrival Time
                      </p>
                      <p className="font-medium">{busDetails.arrival_time}</p>
                    </div>
                  )}
                  {busDetails?.capacity && (
                    <div>
                      <p className="text-sm text-muted-foreground">Bus Capacity</p>
                      <p className="font-medium">{busDetails.capacity} seats</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Fee Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Month</p>
                    <p className="font-medium">
                      {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Status</p>
                    <div className="mt-1">
                      {feeStatus ? (
                        <Badge variant={feeStatus.status === 'paid' ? 'default' : 'destructive'}>
                          {feeStatus.status === 'paid' ? 'Paid' : 'Due'}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">No record</Badge>
                      )}
                    </div>
                  </div>
                  {feeStatus?.amount && (
                    <div>
                      <p className="text-sm text-muted-foreground">Amount</p>
                      <p className="font-medium">₹{feeStatus.amount}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default BusDetails;
