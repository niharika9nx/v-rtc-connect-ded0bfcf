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
    }
  }, [user]);

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

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">
            Admin Dashboard - Welcome, {profile?.name || 'Admin'}
          </h1>
          <Button onClick={signOut} variant="outline">
            Logout
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/profile')}
          >
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">View your admin profile</p>
            </CardContent>
          </Card>
          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/admin/buses')}
          >
            <CardHeader>
              <CardTitle>Buses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Manage bus routes and details</p>
            </CardContent>
          </Card>

          <Dialog open={complaintsOpen} onOpenChange={setComplaintsOpen}>
            <DialogTrigger asChild>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle>Complaints</CardTitle>
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
            <DialogContent className="max-w-3xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Complaints</DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[60vh]">
                <div className="space-y-4 pr-4">
                  {complaints.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No complaints found</p>
                  ) : (
                    complaints.map((complaint) => (
                      <Card key={complaint.id}>
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium">{complaint.profiles?.name || 'Unknown User'}</p>
                              <p className="text-sm text-muted-foreground">
                                {complaint.profiles?.registration_id || 'N/A'}
                              </p>
                            </div>
                            <Badge variant={complaint.status === 'resolved' ? 'default' : 'secondary'}>
                              {complaint.status}
                            </Badge>
                          </div>
                          <p className="text-sm mb-3">{complaint.message}</p>
                          <div className="flex justify-between items-center">
                            <p className="text-xs text-muted-foreground">
                              {new Date(complaint.created_at).toLocaleDateString()}
                            </p>
                            {complaint.status === 'pending' && (
                              <Button
                                size="sm"
                                onClick={() => handleResolveComplaint(complaint.id)}
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
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle>Announcements</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Create and manage announcements</p>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Announcements</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="announcement">Create New Announcement</Label>
                  <Textarea
                    id="announcement"
                    placeholder="Enter announcement message (max 500 characters)"
                    value={newAnnouncement}
                    onChange={(e) => setNewAnnouncement(e.target.value)}
                    maxLength={500}
                    rows={4}
                  />
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">
                      {newAnnouncement.length}/500 characters
                    </p>
                    <Button 
                      onClick={handleCreateAnnouncement}
                      disabled={loading || !newAnnouncement.trim()}
                    >
                      {loading ? 'Creating...' : 'Create Announcement'}
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Recent Announcements</h3>
                  <ScrollArea className="h-[40vh]">
                    <div className="space-y-3 pr-4">
                      {announcements.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No announcements yet</p>
                      ) : (
                        announcements.map((announcement) => (
                          <Card key={announcement.id}>
                            <CardContent className="pt-4">
                              <p className="text-sm mb-2">{announcement.message}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(announcement.created_at).toLocaleDateString()} at{' '}
                                {new Date(announcement.created_at).toLocaleTimeString()}
                              </p>
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
      </div>
    </div>
  );
};

export default AdminDashboard;
