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
  const [showPassButton, setShowPassButton] = useState(false);
  const [passData, setPassData] = useState<any>(null);

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

          // Fetch pass data
          const { data: passInfo } = await supabase
            .from('passes')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
          
          setPassData(passInfo);

          // Check if PASS button should be displayed
          // Show if: fee is paid AND (no monthly pass OR pass expired)
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

          const hasNoPass = !passInfo?.monthly_pass_url;
          const hasExpiredPass = passInfo?.expiry_date && new Date(passInfo.expiry_date) < new Date();
          const feePaid = !!feeData;

          setShowPassButton(feePaid && (hasNoPass || hasExpiredPass));

          // Fetch route image if bus_number exists
          if (data?.bus_number) {
            // Since route bucket is public, get public URL directly
            const possibleFileNames = [
              `bus-${data.bus_number}.png`,
              `${data.bus_number}.png`,
              'route.png'
            ];

            for (const fileName of possibleFileNames) {
              const { data: publicUrl } = supabase.storage
                .from('route')
                .getPublicUrl(fileName);
              
              if (publicUrl?.publicUrl) {
                // Verify the file exists by checking if we can access it
                try {
                  const response = await fetch(publicUrl.publicUrl, { method: 'HEAD' });
                  if (response.ok) {
                    setRouteImageUrl(publicUrl.publicUrl);
                    break;
                  }
                } catch (error) {
                  // Continue to next file name
                  continue;
                }
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
    <div className="min-h-screen bg-background bg-mesh">
      {/* Modern Header with gradient */}
      <div className="border-b border-border/30 glass sticky top-0 z-50 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-primary opacity-10" />
        <div className="relative max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">VBus</h1>
            <p className="text-sm text-muted-foreground">Welcome back, {profile?.name || 'User'}</p>
          </div>
          <Button onClick={signOut} variant="outline" className="border-primary/30 hover:bg-primary/10 hover:shadow-glow transition-all">
            Logout
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Pass Expiry Alert */}
        {passExpiryStatus?.isExpired && (
          <Alert variant="destructive" className="border-destructive animate-slide-up shadow-lg">
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

        {/* PASS Button for Fee Paid but No Pass */}
        {showPassButton && (
          <Card className="glass animate-slide-up shadow-glow border-primary/50">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-2 text-foreground font-display">
                    Bus Pass Required
                  </h3>
                  <p className="text-muted-foreground">
                    Your monthly fee is paid, but {passData?.monthly_pass_url ? 'your pass has expired' : 'no bus pass has been uploaded'}. 
                    Please upload your monthly pass to continue using bus services.
                  </p>
                </div>
                <Button 
                  onClick={() => navigate('/expired-pass-letter')}
                  className="ml-4 bg-gradient-primary hover:shadow-glow font-bold text-lg px-8 py-6 h-auto"
                >
                  PASS
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {passExpiryStatus?.isExpiringSoon && !passExpiryStatus?.isExpired && (
          <Alert className="border-yellow-500 bg-yellow-500/10 animate-slide-up shadow-md">
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

        {/* Announcements Bar with glassmorphism */}
        {announcements.length > 0 && (
          <Card className="glass animate-slide-up shadow-glow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-display">
                <Bell className="h-5 w-5 text-primary" />
                Announcements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {announcements.map((announcement, index) => (
                <Alert key={announcement.id} className="bg-background/50 border-primary/20" style={{ animationDelay: `${index * 0.1}s` }}>
                  <AlertCircle className="h-4 w-4 text-primary" />
                  <AlertDescription>{announcement.message}</AlertDescription>
                </Alert>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Main Navigation Buttons with modern cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card 
            className="glass hover:shadow-glow transition-all duration-300 cursor-pointer group animate-slide-up hover:scale-105 overflow-hidden relative"
            onClick={() => navigate('/profile')}
            style={{ animationDelay: '0.1s' }}
          >
            <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-10 transition-opacity" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3 font-display">
                <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <User className="h-6 w-6 text-primary" />
                </div>
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">View and manage your personal details</p>
            </CardContent>
          </Card>

          <Card 
            className="glass hover:shadow-glow transition-all duration-300 cursor-pointer group animate-slide-up hover:scale-105 overflow-hidden relative"
            onClick={() => navigate('/bus-details')}
            style={{ animationDelay: '0.2s' }}
          >
            <div className="absolute inset-0 bg-gradient-secondary opacity-0 group-hover:opacity-10 transition-opacity" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3 font-display">
                <div className="p-2 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors">
                  <Bus className="h-6 w-6 text-accent" />
                </div>
                Bus Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Check your bus route and timings</p>
            </CardContent>
          </Card>

          <Card 
            className="glass hover:shadow-glow transition-all duration-300 cursor-pointer group animate-slide-up hover:scale-105 overflow-hidden relative"
            onClick={() => navigate('/epass')}
            style={{ animationDelay: '0.3s' }}
          >
            <div className="absolute inset-0 bg-gradient-accent opacity-0 group-hover:opacity-10 transition-opacity" />
            <CardHeader>
              <CardTitle className="flex items-center gap-3 font-display">
                <div className="p-2 rounded-lg bg-secondary/10 group-hover:bg-secondary/20 transition-colors">
                  <CreditCard className="h-6 w-6 text-secondary" />
                </div>
                E-Pass
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Manage your monthly bus pass</p>
            </CardContent>
          </Card>
        </div>

        {/* Bus Route Image with modern styling */}
        {profile?.bus_number && (
          <Card className="glass animate-slide-up shadow-lg" style={{ animationDelay: '0.4s' }}>
            <CardHeader>
              <CardTitle className="font-display">Your Bus Route</CardTitle>
            </CardHeader>
            <CardContent>
              {routeImageUrl ? (
                <div className="rounded-xl overflow-hidden shadow-md hover:shadow-glow transition-shadow">
                  <img 
                    src={routeImageUrl} 
                    alt={`Route map for bus ${profile.bus_number}`}
                    className="w-full h-auto"
                  />
                  <p className="text-center text-sm text-muted-foreground mt-4 font-medium">
                    Bus Number: {profile.bus_number}
                  </p>
                </div>
              ) : (
                <div className="bg-gradient-primary/5 rounded-xl p-12 text-center">
                  <Bus className="h-20 w-20 mx-auto mb-4 text-primary animate-float" />
                  <p className="text-lg font-semibold mb-2 font-display">Bus Number: {profile.bus_number}</p>
                  <p className="text-sm text-muted-foreground">No route map available</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Report an Issue with modern form styling */}
        <Card className="glass animate-slide-up shadow-lg" style={{ animationDelay: '0.5s' }}>
          <CardHeader>
            <CardTitle className="font-display">Report an Issue</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleComplaintSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="complaint" className="font-medium">Describe your issue</Label>
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
                  className={`resize-none transition-all ${validationError ? 'border-destructive' : 'focus:border-primary'}`}
                />
                {validationError && (
                  <p className="text-sm text-destructive font-medium">{validationError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {complaint.length}/1000 characters
                </p>
              </div>
              <Button 
                type="submit" 
                disabled={submitting || !complaint.trim()}
                className="bg-gradient-primary hover:shadow-glow transition-all font-medium"
              >
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
