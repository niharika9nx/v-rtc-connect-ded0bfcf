import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, Bus, MessageSquare, Megaphone, Trash2, Upload, Send } from 'lucide-react';

interface Complaint {
  id: string;
  message: string;
  status: string;
  created_at: string;
  user_id: string;
  profiles: {
    name: string;
    registration_id: string;
  };
}

const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [complaintsOpen, setComplaintsOpen] = useState(false);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [routeImageUrl, setRouteImageUrl] = useState<string | null>(null);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data }) => setProfile(data));
      
      fetchComplaints();
      fetchAnnouncements();
      fetchRouteImage();
      fetchPendingRequestsCount();
    }
  }, [user]);

  const fetchPendingRequestsCount = async () => {
    const { count } = await supabase
      .from('bus_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    setPendingRequestsCount(count || 0);
  };

  const fetchRouteImage = async () => {
    // Try to fetch a default route image
    const possibleFileNames = [
      'route.png',
      'bus-1.png',
      'bus-2.png'
    ];

    for (const fileName of possibleFileNames) {
      const { data: publicUrl } = supabase.storage
        .from('route')
        .getPublicUrl(fileName);
      
      if (publicUrl?.publicUrl) {
        try {
          const response = await fetch(publicUrl.publicUrl, { method: 'HEAD' });
          if (response.ok) {
            setRouteImageUrl(publicUrl.publicUrl);
            break;
          }
        } catch (error) {
          continue;
        }
      }
    }
  };

  const fetchComplaints = async () => {
    const { data, error } = await supabase
      .from('complaints')
      .select(`
        *,
        profiles:user_id (
          name,
          registration_id
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setComplaints(data as Complaint[]);
    }
  };

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setAnnouncements(data);
    }
  };

  const handleResolveComplaint = async (complaintId: string) => {
    const { error } = await supabase
      .from('complaints')
      .update({ status: 'resolved' })
      .eq('id', complaintId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to resolve complaint',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Complaint marked as resolved',
      });
      fetchComplaints();
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!newAnnouncement.trim()) {
      toast({
        title: 'Error',
        description: 'Announcement message cannot be empty',
        variant: 'destructive',
      });
      return;
    }

    if (newAnnouncement.length > 500) {
      toast({
        title: 'Error',
        description: 'Announcement message must be less than 500 characters',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('announcements')
      .insert({
        admin_id: user?.id,
        message: newAnnouncement.trim(),
      });

    setLoading(false);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to create announcement',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Announcement created successfully',
      });
      setNewAnnouncement('');
      fetchAnnouncements();
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', announcementId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete announcement',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Announcement deleted successfully',
      });
      fetchAnnouncements();
    }
  };


  return (
    <div className="min-h-screen bg-background bg-mesh p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="relative overflow-hidden rounded-lg glass border-border/50 p-6 shadow-lg">
          <div className="absolute inset-0 bg-gradient-primary opacity-10" />
          <div className="relative flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold font-display text-foreground">
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">Welcome back, {profile?.name || 'Admin'}!</p>
            </div>
            <Button 
              onClick={signOut} 
              variant="outline"
              className="border-primary/30 hover:bg-primary/10 hover:shadow-glow"
            >
              Logout
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card 
            className="glass border-border/50 hover:shadow-glow transition-all cursor-pointer animate-slide-up group"
            onClick={() => navigate('/profile')}
            style={{ animationDelay: '0.1s' }}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground group-hover:text-primary transition-colors">
                <User className="h-5 w-5" />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">View your admin profile</p>
            </CardContent>
          </Card>
          
          <Card 
            className="glass border-border/50 hover:shadow-glow transition-all cursor-pointer animate-slide-up group"
            onClick={() => navigate('/admin/buses')}
            style={{ animationDelay: '0.2s' }}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground group-hover:text-primary transition-colors">
                <Bus className="h-5 w-5" />
                Buses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Manage bus routes and details</p>
            </CardContent>
          </Card>

          <Card 
            className="glass border-border/50 hover:shadow-glow transition-all cursor-pointer animate-slide-up group"
            onClick={() => navigate('/admin/bulk-import')}
            style={{ animationDelay: '0.25s' }}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground group-hover:text-primary transition-colors">
                <Upload className="h-5 w-5" />
                Bulk Import
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Import data using CSV / Excel files</p>
            </CardContent>
          </Card>

          <Card 
            className="glass border-border/50 hover:shadow-glow transition-all cursor-pointer animate-slide-up group"
            onClick={() => navigate('/admin/bus-requests')}
            style={{ animationDelay: '0.3s' }}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground group-hover:text-primary transition-colors">
                <Send className="h-5 w-5" />
                Bus Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Manage bus assignment requests</p>
              {pendingRequestsCount > 0 && (
                <Badge variant="destructive" className="mt-2">
                  {pendingRequestsCount} pending
                </Badge>
              )}
            </CardContent>
          </Card>

          <Dialog open={complaintsOpen} onOpenChange={setComplaintsOpen}>
            <DialogTrigger asChild>
              <Card className="glass border-border/50 hover:shadow-glow transition-all cursor-pointer animate-slide-up group" style={{ animationDelay: '0.3s' }}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground group-hover:text-primary transition-colors">
                    <MessageSquare className="h-5 w-5" />
                    Complaints
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">View and resolve user complaints</p>
                  {complaints.filter(c => c.status === 'pending').length > 0 && (
                    <Badge variant="destructive" className="mt-2">
                      {complaints.filter(c => c.status === 'pending').length} pending
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] glass border-border/50">
              <DialogHeader>
                <DialogTitle className="text-foreground">Complaints</DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[60vh]">
                <div className="space-y-4 pr-4">
                  {complaints.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No complaints found</p>
                  ) : (
                    complaints.map((complaint) => (
                      <Card key={complaint.id} className="glass border-border/50">
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium text-foreground">{complaint.profiles?.name || 'Unknown User'}</p>
                              <p className="text-sm text-muted-foreground">
                                {complaint.profiles?.registration_id || 'N/A'}
                              </p>
                            </div>
                            <Badge variant={complaint.status === 'resolved' ? 'default' : 'secondary'}>
                              {complaint.status}
                            </Badge>
                          </div>
                          <p className="text-sm mb-3 text-foreground">{complaint.message}</p>
                          <div className="flex justify-between items-center">
                            <p className="text-xs text-muted-foreground">
                              {new Date(complaint.created_at).toLocaleDateString()}
                            </p>
                            {complaint.status === 'pending' && (
                              <Button
                                size="sm"
                                onClick={() => handleResolveComplaint(complaint.id)}
                                className="bg-primary hover:bg-primary/90"
                              >
                                Mark as Resolved
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          <Dialog open={announcementsOpen} onOpenChange={setAnnouncementsOpen}>
            <DialogTrigger asChild>
              <Card className="glass border-border/50 hover:shadow-glow transition-all cursor-pointer animate-slide-up group" style={{ animationDelay: '0.4s' }}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground group-hover:text-primary transition-colors">
                    <Megaphone className="h-5 w-5" />
                    Announcements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Create and manage announcements</p>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] glass border-border/50">
              <DialogHeader>
                <DialogTitle className="text-foreground">Announcements</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="announcement" className="text-foreground">Create New Announcement</Label>
                  <Textarea
                    id="announcement"
                    placeholder="Enter announcement message (max 500 characters)"
                    value={newAnnouncement}
                    onChange={(e) => setNewAnnouncement(e.target.value)}
                    maxLength={500}
                    rows={4}
                    className="bg-muted/30 border-border/50 text-foreground"
                  />
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">
                      {newAnnouncement.length}/500 characters
                    </p>
                    <Button 
                      onClick={handleCreateAnnouncement}
                      disabled={loading || !newAnnouncement.trim()}
                      className="bg-primary hover:bg-primary/90 hover:shadow-glow"
                    >
                      {loading ? 'Creating...' : 'Create Announcement'}
                    </Button>
                  </div>
                </div>

                <div className="border-t border-border/50 pt-4">
                  <h3 className="font-semibold mb-3 text-foreground">Recent Announcements</h3>
                  <ScrollArea className="h-[40vh]">
                    <div className="space-y-3 pr-4">
                      {announcements.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No announcements yet</p>
                      ) : (
                        announcements.map((announcement) => (
                          <Card key={announcement.id} className="glass border-border/50">
                            <CardContent className="pt-4">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <p className="text-sm mb-2 text-foreground">{announcement.message}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(announcement.created_at).toLocaleDateString()} at{' '}
                                    {new Date(announcement.created_at).toLocaleTimeString()}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteAnnouncement(announcement.id)}
                                  className="hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Bus Route Image */}
        {routeImageUrl && (
          <Card className="glass animate-slide-up shadow-lg" style={{ animationDelay: '0.5s' }}>
            <CardHeader>
              <CardTitle className="font-display">Bus Route Map</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl overflow-hidden shadow-md hover:shadow-glow transition-shadow cursor-pointer"
                onClick={() => window.open(routeImageUrl, '_blank')}
              >
                <img 
                  src={routeImageUrl} 
                  alt="Bus route map"
                  className="w-full h-auto"
                />
              </div>
              <p className="text-center text-sm text-muted-foreground mt-4 font-medium">
                Click image to view in full size
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
