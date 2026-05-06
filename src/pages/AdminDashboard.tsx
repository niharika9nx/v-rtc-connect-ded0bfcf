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
import { User, Bus, MessageSquare, Megaphone, Trash2, Upload, Send, Users, Bell, UserPlus } from 'lucide-react';
import LogoutConfirmDialog from '@/components/LogoutConfirmDialog';
import { useNotifications } from '@/hooks/useNotifications';

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

interface SentAlert {
  id: string;
  user_id: string | null;
  message: string | null;
  status: string | null;
  created_at: string;
  deleted_at: string | null;
  send_at: string | null;
  profiles?: {
    name: string | null;
    role: string | null;
    registration_id: string | null;
  };
}

const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { requestPermission, sendNotification } = useNotifications();
  const [profile, setProfile] = useState<any>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [complaintsOpen, setComplaintsOpen] = useState(false);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertsSent, setAlertsSent] = useState<SentAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [routeImageUrl, setRouteImageUrl] = useState<string | null>(null);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

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
      fetchAlertsSent();
      fetchRouteImage();
      fetchPendingRequestsCount();
      fetchNotifications();
      requestPermission();

      // Realtime subscription for new_account notifications
      const channel = supabase
        .channel('admin-new-account-alerts')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'alerts',
            filter: `user_id=eq.${user.id}`,
          },
          (payload: any) => {
            const row = payload.new;
            if (row?.type === 'new_account') {
              setNotifications((prev) => [row, ...prev]);
              sendNotification('🆕 New Account Created', { body: row.message });
              toast({ title: 'New Account', description: row.message });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'new_account')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setNotifications(data);
  };

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

  const fetchAlertsSent = async () => {
    const { data, error } = await supabase
      .from('alerts')
      .select(`
        id,
        user_id,
        message,
        status,
        created_at,
        deleted_at,
        send_at,
        profiles:user_id (
          name,
          role,
          registration_id
        )
      `)
      .eq('type', 'custom')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setAlertsSent(data as SentAlert[]);
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
    <div className="min-h-screen bg-background bg-mesh p-3 sm:p-4">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        <div className="relative overflow-hidden rounded-lg glass border-border/50 p-4 sm:p-6 shadow-lg">
          <div className="absolute inset-0 bg-gradient-primary opacity-10" />
          <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold font-display text-foreground">
                Admin Dashboard
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">Welcome back, {profile?.name || 'Admin'}!</p>
            </div>
            <LogoutConfirmDialog onConfirm={signOut} triggerClassName="border-primary/30 hover:bg-primary/10 hover:shadow-glow w-full sm:w-auto" />
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

          <Card 
            className="glass border-border/50 hover:shadow-glow transition-all cursor-pointer animate-slide-up group"
            onClick={() => navigate('/admin/users')}
            style={{ animationDelay: '0.35s' }}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground group-hover:text-primary transition-colors">
                <Users className="h-5 w-5" />
                All Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">View all students and faculty</p>
            </CardContent>
          </Card>

          <Dialog open={alertsOpen} onOpenChange={setAlertsOpen}>
            <DialogTrigger asChild>
              <Card
                className="glass border-border/50 hover:shadow-glow transition-all cursor-pointer animate-slide-up group"
                style={{ animationDelay: '0.38s' }}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground group-hover:text-primary transition-colors">
                    <Bell className="h-5 w-5" />
                    Alerts Sent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">View alerts sent to students / faculty</p>
                  {alertsSent.length > 0 && (
                    <Badge className="mt-2" variant="secondary">
                      {alertsSent.length} total
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </DialogTrigger>

            <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] glass border-border/50 p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle className="text-foreground">Alerts Sent</DialogTitle>
              </DialogHeader>

              <ScrollArea className="h-[60vh]">
                <div className="space-y-4 pr-4">
                  {alertsSent.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No admin alerts sent yet</p>
                  ) : (
                    alertsSent.map((alert) => {
                      const recipientName = alert.profiles?.name || 'Unknown User';
                      const recipientRole = alert.profiles?.role || 'user';
                      const status = alert.status || 'unknown';
                      const isDismissed = status === 'dismissed' || !!alert.deleted_at;

                      return (
                        <Card key={alert.id} className="glass border-border/50">
                          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground truncate">{recipientName}</p>
                                <p className="text-xs sm:text-sm text-muted-foreground capitalize">
                                  {recipientRole}
                                  {alert.profiles?.registration_id ? ` • ${alert.profiles.registration_id}` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant={isDismissed ? 'secondary' : status === 'unread' ? 'destructive' : 'default'}>
                                  {status}
                                </Badge>
                              </div>
                            </div>

                            <p className="text-sm mb-3 text-foreground break-words">{alert.message || '—'}</p>

                            <p className="text-xs text-muted-foreground">
                              {new Date(alert.created_at).toLocaleDateString()} at {new Date(alert.created_at).toLocaleTimeString()}
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>

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
            <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] glass border-border/50 p-4 sm:p-6">
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
                        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">{complaint.profiles?.name || 'Unknown User'}</p>
                              <p className="text-xs sm:text-sm text-muted-foreground">
                                {complaint.profiles?.registration_id || 'N/A'}
                              </p>
                            </div>
                            <Badge variant={complaint.status === 'resolved' ? 'default' : 'secondary'} className="shrink-0">
                              {complaint.status}
                            </Badge>
                          </div>
                          <p className="text-sm mb-3 text-foreground break-words">{complaint.message}</p>
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <p className="text-xs text-muted-foreground">
                              {new Date(complaint.created_at).toLocaleDateString()}
                            </p>
                            {complaint.status === 'pending' && (
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResolveComplaint(complaint.id);
                                }}
                                className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
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

          <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <DialogTrigger asChild>
              <Card className="glass border-border/50 hover:shadow-glow transition-all cursor-pointer animate-slide-up group" style={{ animationDelay: '0.39s' }}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground group-hover:text-primary transition-colors">
                    <UserPlus className="h-5 w-5" />
                    Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">New student / faculty account creations</p>
                  {notifications.length > 0 && (
                    <Badge className="mt-2" variant="secondary">
                      {notifications.length} total
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] glass border-border/50 p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle className="text-foreground">Notifications</DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[60vh]">
                <div className="space-y-3 pr-4">
                  {notifications.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No notifications yet</p>
                  ) : (
                    notifications.map((n) => (
                      <Card key={n.id} className="glass border-border/50">
                        <CardContent className="pt-4 px-3 sm:px-6">
                          <p className="text-sm text-foreground break-words">{n.message}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(n.created_at).toLocaleString()}
                          </p>
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
            <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] glass border-border/50 p-4 sm:p-6">
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
