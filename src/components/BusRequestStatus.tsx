import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react';

interface BusRequest {
  id: string;
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
}

export const BusRequestStatus = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<BusRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchRequests();

      // Subscribe to changes
      const channel = supabase
        .channel('bus-requests-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bus_requests',
            filter: `user_id=eq.${user.id}`
          },
          () => fetchRequests()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchRequests = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('bus_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRequests(data as BusRequest[]);
    }
    setLoading(false);
  };

  const handleDelete = async (requestId: string) => {
    const { error } = await supabase
      .from('bus_requests')
      .delete()
      .eq('id', requestId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete request',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Deleted',
        description: 'Request deleted successfully',
      });
      fetchRequests();
    }
  };

  if (loading || requests.length === 0) return null;

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const resolvedRequests = requests.filter(r => r.status !== 'pending');

  return (
    <Card className="glass animate-slide-up shadow-lg border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-display">
          <Clock className="h-5 w-5 text-primary" />
          Bus Request Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingRequests.map((request) => (
          <div 
            key={request.id} 
            className="p-4 rounded-lg bg-muted/50 border border-border/50 space-y-2"
          >
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">
                <Clock className="h-3 w-3 mr-1" />
                Pending
              </Badge>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hover:bg-destructive/10 hover:text-destructive h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Request</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure to delete the request?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>NO</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(request.id)}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      YES
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <p className="text-sm text-foreground">
              {request.request_type === 'existing' 
                ? `Requested Bus: ${request.requested_bus_number}`
                : `New user request: ${request.from_month} - ${request.to_month} ${request.year}`
              }
            </p>
            {request.college && (
              <p className="text-xs text-muted-foreground">
                College: {request.college} | Year: {request.study_year}
              </p>
            )}
            {request.comment && (
              <p className="text-xs text-muted-foreground italic">"{request.comment}"</p>
            )}
            <p className="text-xs text-muted-foreground">
              Submitted: {new Date(request.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}

        {resolvedRequests.map((request) => (
          <div 
            key={request.id} 
            className={`p-4 rounded-lg border space-y-2 ${
              request.status === 'approved' 
                ? 'bg-green-500/10 border-green-500/30' 
                : 'bg-destructive/10 border-destructive/30'
            }`}
          >
            <div className="flex items-center gap-2">
              {request.status === 'approved' ? (
                <Badge className="bg-green-500 hover:bg-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Approved
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Rejected
                </Badge>
              )}
            </div>
            {request.status === 'approved' && (
              <div className="text-sm text-foreground">
                <p>Assigned Bus: <span className="font-bold text-primary">{request.assigned_bus_number}</span></p>
                {request.assigned_seat_number && (
                  <p>Seat Number: <span className="font-bold text-accent">{request.assigned_seat_number}</span></p>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {new Date(request.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
