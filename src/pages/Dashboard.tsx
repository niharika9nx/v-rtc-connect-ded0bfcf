import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { Bell, User, Bus, CreditCard, AlertCircle, AlertTriangle } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';

const complaintSchema = z.object({
  message: z
    .string()
    .trim()
    .min(10, { message: "Complaint must be at least 10 characters" })
    .max(1000, { message: "Complaint must be less than 1000 characters" })
});

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [complaint, setComplaint] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [passExpiryStatus, setPassExpiryStatus] = useState<{
    daysUntilExpiry: number;
    isExpired: boolean;
    isExpiringSoon: boolean;
  } | null>(null);
  const [routeImageUrl, setRouteImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      // Fetch profile
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
        .then(async ({ data }) => {
          setProfile(data);
          
          // Calculate pass expiry status
          if (data?.pass_expiry_date) {
            const expiryDate = parseISO(data.pass_expiry_date);
            const today = new Date();
            const daysUntilExpiry = differenceInDays(expiryDate, today);
            
            setPassExpiryStatus({
              daysUntilExpiry,
              isExpired: daysUntilExpiry < 0,
              isExpiringSoon: daysUntilExpiry >= 0 && daysUntilExpiry <= 5
            });
          }

          // Fetch route image if bus_number exists
          if (data?.bus_number) {
            // Try to get the route image (try bus-specific file first, then general route.png)
            const possibleFileNames = [
              `bus-${data.bus_number}.png`,
              `${data.bus_number}.png`,
              'route.png'
            ];

            for (const fileName of possibleFileNames) {
              const { data: urlData, error } = await supabase.storage
                .from('route')
                .createSignedUrl(fileName, 3600); // 1 hour expiry
              
              if (urlData?.signedUrl && !error) {
                setRouteImageUrl(urlData.signedUrl);
                break;
              }
            }
          }
        });

      // Fetch announcements
      supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3)
        .then(({ data }) => setAnnouncements(data || []));

      // Subscribe to new announcements
      const channel = supabase
        .channel('announcements-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'announcements'
          },
          (payload) => {
            setAnnouncements(prev => [payload.new, ...prev].slice(0, 3));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const handleComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate input
    const validation = complaintSchema.safeParse({ message: complaint });
    if (!validation.success) {
      setValidationError(validation.error.errors[0].message);
      return;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from('complaints')
      .insert({
        user_id: user?.id,
        message: validation.data.message
      });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit complaint. Please try again.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Complaint Submitted',
        description: 'Your issue has been reported successfully.',
      });
      setComplaint('');
    }

    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">VBus - College Transport</h1>
            <p className="text-sm text-muted-foreground">Welcome, {profile?.name || 'User'}</p>
          </div>
          <Button onClick={signOut} variant="outline">
            Logout
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Pass Expiry Alert */}
        {passExpiryStatus?.isExpired && (
          <Alert variant="destructive" className="border-destructive">
            <AlertTriangle className="h-5 w-5" />
            <AlertDescription className="flex items-center justify-between">
              <div>
                <p className="font-semibold mb-1">PASS EXPIRED</p>
                <p>Your bus pass has expired. Please upload a new pass or contact admin.</p>
              </div>
              <Button 
                variant="outline" 
                className="ml-4 border-destructive-foreground hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => navigate('/expired-pass-letter')}
              >
                PASS Letter
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {passExpiryStatus?.isExpiringSoon && !passExpiryStatus?.isExpired && (
          <Alert className="border-yellow-500 bg-yellow-500/10">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <AlertDescription>
              <p className="font-semibold text-yellow-800 dark:text-yellow-300">
                Pass Expiring Soon
              </p>
              <p className="text-yellow-700 dark:text-yellow-400">
                Your bus pass will expire in {passExpiryStatus.daysUntilExpiry} day
                {passExpiryStatus.daysUntilExpiry !== 1 ? 's' : ''}. Please renew it soon.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Announcements Bar */}
        {announcements.length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5" />
                Announcements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {announcements.map((announcement) => (
                <Alert key={announcement.id} className="bg-background/50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{announcement.message}</AlertDescription>
                </Alert>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Main Navigation Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card 
            className="hover:shadow-lg transition-all cursor-pointer hover:border-primary"
            onClick={() => navigate('/profile')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">View and manage your personal details</p>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-lg transition-all cursor-pointer hover:border-primary"
            onClick={() => navigate('/bus-details')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bus className="h-5 w-5" />
                Bus Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Check your bus route and timings</p>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-lg transition-all cursor-pointer hover:border-primary"
            onClick={() => navigate('/epass')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                E-Pass
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Manage your monthly bus pass</p>
            </CardContent>
          </Card>
        </div>

        {/* Bus Route Image */}
        {profile?.bus_number && (
          <Card>
            <CardHeader>
              <CardTitle>Your Bus Route</CardTitle>
            </CardHeader>
            <CardContent>
              {routeImageUrl ? (
                <div className="rounded-lg overflow-hidden">
                  <img 
                    src={routeImageUrl} 
                    alt={`Route map for bus ${profile.bus_number}`}
                    className="w-full h-auto"
                  />
                  <p className="text-center text-sm text-muted-foreground mt-2">
                    Bus Number: {profile.bus_number}
                  </p>
                </div>
              ) : (
                <div className="bg-muted rounded-lg p-8 text-center">
                  <Bus className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-semibold mb-2">Bus Number: {profile.bus_number}</p>
                  <p className="text-sm text-muted-foreground">No route map available</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Report an Issue */}
        <Card>
          <CardHeader>
            <CardTitle>Report an Issue</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleComplaintSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="complaint">Describe your issue</Label>
                <Textarea
                  id="complaint"
                  placeholder="Please describe the issue you're facing (minimum 10 characters)..."
                  value={complaint}
                  onChange={(e) => {
                    setComplaint(e.target.value);
                    setValidationError(null);
                  }}
                  rows={4}
                  maxLength={1000}
                  className={validationError ? 'border-destructive' : ''}
                />
                {validationError && (
                  <p className="text-sm text-destructive">{validationError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {complaint.length}/1000 characters
                </p>
              </div>
              <Button type="submit" disabled={submitting || !complaint.trim()}>
                {submitting ? 'Submitting...' : 'Submit Complaint'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
