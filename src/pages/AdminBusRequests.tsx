import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Bus, UserCheck, UserX, Clock, Search } from 'lucide-react';

interface BusRequest {
  id: string;
  user_id: string;
  request_type: string;
  requested_bus_number: string | null;
  from_month: string | null;
  to_month: string | null;
  year: number | null;
  college: string | null;
  study_year: string | null;
  comment: string | null;
  status: string;
  assigned_bus_number: string | null;
  assigned_seat_number: number | null;
  created_at: string;
  profiles?: {
    name: string | null;
    email: string | null;
    phone: string | null;
    role: string | null;
    registration_id: string | null;
  } | null;
}

const AdminBusRequests = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [buses, setBuses] = useState<any[]>([]);
  const [requests, setRequests] = useState<BusRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Assignment dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<BusRequest | null>(null);
  const [assignBusNumber, setAssignBusNumber] = useState('');
  const [assignSeatNumber, setAssignSeatNumber] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchData();

    // Subscribe to changes
    const channel = supabase
      .channel('admin-bus-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bus_requests' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    // Fetch buses
    const { data: busData } = await supabase
      .from('bus_details')
      .select('bus_number, route')
      .order('bus_number');
    setBuses(busData || []);

    // Fetch all pending requests
    const { data: requestData, error } = await supabase
      .from('bus_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (!error && requestData) {
      // Fetch profiles for each request
      const userIds = requestData.map(r => r.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, email, phone, role, registration_id')
        .in('id', userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      
      const requestsWithProfiles = requestData.map(r => ({
        ...r,
        profiles: profilesMap.get(r.user_id) || null
      }));

      setRequests(requestsWithProfiles as BusRequest[]);
    }
    setLoading(false);
  };

  const handleAssignClick = (request: BusRequest) => {
    setSelectedRequest(request);
    setAssignBusNumber(request.requested_bus_number || '');
    setAssignSeatNumber('');
    setAssignDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedRequest || !assignBusNumber) {
      toast({
        title: 'Error',
        description: 'Please select a bus number',
        variant: 'destructive',
      });
      return;
    }

    setAssigning(true);

    // Update the request
    const { error: requestError } = await supabase
      .from('bus_requests')
      .update({
        status: 'approved',
        assigned_bus_number: assignBusNumber,
        assigned_seat_number: assignSeatNumber ? parseInt(assignSeatNumber) : null,
      })
      .eq('id', selectedRequest.id);

    if (requestError) {
      toast({
        title: 'Error',
        description: 'Failed to approve request',
        variant: 'destructive',
      });
      setAssigning(false);
      return;
    }

    // Update user's profile with bus number and seat
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        bus_number: assignBusNumber,
        seat_number: assignSeatNumber ? parseInt(assignSeatNumber) : null,
      })
      .eq('id', selectedRequest.user_id);

    setAssigning(false);

    if (profileError) {
      toast({
        title: 'Warning',
        description: 'Request approved but failed to update user profile',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Bus assigned successfully',
      });
    }

    setAssignDialogOpen(false);
    fetchData();
  };

  const handleReject = async (requestId: string) => {
    const { error } = await supabase
      .from('bus_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to reject request',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Rejected',
        description: 'Request has been rejected',
      });
      fetchData();
    }
  };

  // Filter requests by bus and search
  const getFilteredRequests = (busNumber?: string) => {
    let filtered = requests;
    
    if (busNumber && busNumber !== 'all') {
      filtered = filtered.filter(r => r.requested_bus_number === busNumber);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.profiles?.name?.toLowerCase().includes(query) ||
        r.profiles?.email?.toLowerCase().includes(query) ||
        r.profiles?.registration_id?.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  // Separate students and faculty
  const getStudentRequests = (busNumber?: string) => 
    getFilteredRequests(busNumber).filter(r => r.profiles?.role === 'student');
  
  const getFacultyRequests = (busNumber?: string) => 
    getFilteredRequests(busNumber).filter(r => r.profiles?.role === 'faculty');

  const newUserRequests = requests.filter(r => r.request_type === 'new');

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
          <Button variant="ghost" onClick={() => navigate('/admin')} className="mb-2 hover:bg-primary/10">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
                <Bus className="h-6 w-6 text-primary" />
                Bus Requests
              </h1>
              <p className="text-sm text-muted-foreground">
                {requests.length} pending request{requests.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or registration ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-muted/30 border-border/50"
          />
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="glass border-border/50 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="all" className="data-[state=active]:bg-primary/20">
              All ({requests.length})
            </TabsTrigger>
            <TabsTrigger value="new" className="data-[state=active]:bg-primary/20">
              New Users ({newUserRequests.length})
            </TabsTrigger>
            {buses.map((bus) => (
              <TabsTrigger 
                key={bus.bus_number} 
                value={bus.bus_number}
                className="data-[state=active]:bg-primary/20"
              >
                Bus {bus.bus_number} ({getFilteredRequests(bus.bus_number).length})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="space-y-6 mt-6">
            <RequestsList 
              title="Students"
              requests={getStudentRequests()}
              onAssign={handleAssignClick}
              onReject={handleReject}
            />
            <RequestsList 
              title="Faculty"
              requests={getFacultyRequests()}
              onAssign={handleAssignClick}
              onReject={handleReject}
            />
          </TabsContent>

          <TabsContent value="new" className="space-y-6 mt-6">
            <RequestsList 
              title="New User Requests"
              requests={newUserRequests.filter(r => 
                !searchQuery.trim() || 
                r.profiles?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase())
              )}
              onAssign={handleAssignClick}
              onReject={handleReject}
              showDetails
            />
          </TabsContent>

          {buses.map((bus) => (
            <TabsContent key={bus.bus_number} value={bus.bus_number} className="space-y-6 mt-6">
              <RequestsList 
                title={`Students - Bus ${bus.bus_number}`}
                requests={getStudentRequests(bus.bus_number)}
                onAssign={handleAssignClick}
                onReject={handleReject}
              />
              <RequestsList 
                title={`Faculty - Bus ${bus.bus_number}`}
                requests={getFacultyRequests(bus.bus_number)}
                onAssign={handleAssignClick}
                onReject={handleReject}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="glass border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <UserCheck className="h-5 w-5 text-primary" />
              Assign Bus & Seat
            </DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                <p className="font-medium text-foreground">{selectedRequest.profiles?.name}</p>
                <p className="text-sm text-muted-foreground">{selectedRequest.profiles?.email}</p>
                <Badge variant="secondary" className="mt-2">
                  {selectedRequest.profiles?.role}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label>Bus Number</Label>
                <Select value={assignBusNumber} onValueChange={setAssignBusNumber}>
                  <SelectTrigger className="bg-muted/30 border-border/50">
                    <SelectValue placeholder="Select bus" />
                  </SelectTrigger>
                  <SelectContent>
                    {buses.map((bus) => (
                      <SelectItem key={bus.bus_number} value={bus.bus_number}>
                        Bus {bus.bus_number} {bus.route ? `- ${bus.route}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Seat Number (Optional)</Label>
                <Input
                  type="number"
                  value={assignSeatNumber}
                  onChange={(e) => setAssignSeatNumber(e.target.value)}
                  placeholder="Enter seat number"
                  className="bg-muted/30 border-border/50"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setAssignDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleAssign}
                  disabled={assigning || !assignBusNumber}
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  {assigning ? 'Assigning...' : 'Assign & Approve'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface RequestsListProps {
  title: string;
  requests: BusRequest[];
  onAssign: (request: BusRequest) => void;
  onReject: (requestId: string) => void;
  showDetails?: boolean;
}

const RequestsList = ({ title, requests, onAssign, onReject, showDetails }: RequestsListProps) => {
  if (requests.length === 0) {
    return (
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-lg font-display">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">No requests found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          {title}
          <Badge variant="secondary">{requests.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3 pr-4">
            {requests.map((request) => (
              <div 
                key={request.id}
                className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{request.profiles?.name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">{request.profiles?.email}</p>
                    {request.profiles?.registration_id && (
                      <p className="text-xs text-muted-foreground">ID: {request.profiles.registration_id}</p>
                    )}
                  </div>
                  <Badge variant={request.request_type === 'new' ? 'default' : 'secondary'}>
                    {request.request_type === 'new' ? 'New User' : 'Existing'}
                  </Badge>
                </div>

                {request.request_type === 'existing' && (
                  <p className="text-sm">
                    Requested Bus: <span className="font-bold text-primary">{request.requested_bus_number}</span>
                  </p>
                )}

                {showDetails && request.request_type === 'new' && (
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p>Duration: {request.from_month} - {request.to_month} {request.year}</p>
                    <p>College: {request.college}</p>
                    <p>Study Year: {request.study_year}</p>
                    {request.comment && (
                      <p className="italic">Comment: "{request.comment}"</p>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button 
                    size="sm" 
                    onClick={() => onAssign(request)}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <UserCheck className="h-4 w-4 mr-1" />
                    Assign
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onReject(request.id)}
                    className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
                  >
                    <UserX className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Submitted: {new Date(request.created_at).toLocaleDateString()} at {new Date(request.created_at).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default AdminBusRequests;
