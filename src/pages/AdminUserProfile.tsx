import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UserProfile {
  id: string;
  name: string;
  role: string;
  college: string;
  branch?: string;
  year?: string;
  section?: string;
  department?: string;
  phone: string;
  gender: string;
  registration_id?: string;
  bus_number: string;
  pass_expiry_date?: string;
}

interface FeeHistory {
  id: string;
  month: string;
  year: number;
  status: string;
  amount: number;
  created_at: string;
}

const AdminUserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [feeHistory, setFeeHistory] = useState<FeeHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
      fetchFeeHistory();
    }
  }, [userId]);

  const fetchUserProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load user profile',
        variant: 'destructive',
      });
    } else {
      setProfile(data);
    }
    setLoading(false);
  };

  const fetchFeeHistory = async () => {
    const { data, error } = await supabase
      .from('fee_history')
      .select('*')
      .eq('user_id', userId)
      .order('year', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load fee history',
        variant: 'destructive',
      });
    } else {
      setFeeHistory(data || []);
    }
  };

  const handleFeeStatusChange = async (feeId: string, newStatus: 'paid' | 'due') => {
    const { error } = await supabase
      .from('fee_history')
      .update({ status: newStatus })
      .eq('id', feeId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update fee status',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Fee status updated successfully',
      });
      setFeeHistory(
        feeHistory.map((fee) =>
          fee.id === feeId ? { ...fee, status: newStatus } : fee
        )
      );
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">User not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">User Profile</h1>
          <Button onClick={() => navigate(-1)} variant="outline">
            Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-semibold">{profile.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <p className="font-semibold capitalize">{profile.role}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-semibold">{profile.phone}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gender</p>
                <p className="font-semibold capitalize">{profile.gender}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">College</p>
                <p className="font-semibold">{profile.college}</p>
              </div>
              {profile.branch && (
                <div>
                  <p className="text-sm text-muted-foreground">Branch</p>
                  <p className="font-semibold">{profile.branch}</p>
                </div>
              )}
              {profile.year && (
                <div>
                  <p className="text-sm text-muted-foreground">Year</p>
                  <p className="font-semibold">{profile.year}</p>
                </div>
              )}
              {profile.section && (
                <div>
                  <p className="text-sm text-muted-foreground">Section</p>
                  <p className="font-semibold">{profile.section}</p>
                </div>
              )}
              {profile.department && (
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-semibold">{profile.department}</p>
                </div>
              )}
              {profile.registration_id && (
                <div>
                  <p className="text-sm text-muted-foreground">Registration ID</p>
                  <p className="font-semibold">{profile.registration_id}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Bus Number</p>
                <p className="font-semibold">{profile.bus_number}</p>
              </div>
              {profile.pass_expiry_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Pass Expiry Date</p>
                  <p className="font-semibold">
                    {new Date(profile.pass_expiry_date).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fee History</CardTitle>
          </CardHeader>
          <CardContent>
            {feeHistory.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No fee history found
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feeHistory.map((fee) => (
                    <TableRow key={fee.id}>
                      <TableCell className="font-medium">{fee.month}</TableCell>
                      <TableCell>{fee.year}</TableCell>
                      <TableCell>₹{fee.amount}</TableCell>
                      <TableCell>
                        <Badge
                          variant={fee.status === 'paid' ? 'default' : 'destructive'}
                        >
                          {fee.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={fee.status}
                          onValueChange={(value: 'paid' | 'due') =>
                            handleFeeStatusChange(fee.id, value)
                          }
                        >
                          <SelectTrigger className="w-[100px] bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="due">Due</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminUserProfile;
