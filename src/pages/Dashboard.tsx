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
import { Bell, User, Bus, CreditCard, AlertCircle } from 'lucide-react';

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

  useEffect(() => {
    if (user) {
      // Fetch profile
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => setProfile(data));

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
              <div className="bg-muted rounded-lg p-8 text-center">
                <Bus className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-semibold mb-2">Bus Number: {profile.bus_number}</p>
                <p className="text-sm text-muted-foreground">Route map will be displayed here</p>
              </div>
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
