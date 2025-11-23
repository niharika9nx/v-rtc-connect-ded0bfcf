import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { formatTo12Hour } from '@/lib/utils';

interface BusDetail {
  bus_number: string;
  route: string;
  departure_time: string;
  arrival_time: string;
  capacity: number;
}

interface Profile {
  id: string;
  name: string;
  role: string;
  college: string;
  branch?: string;
  year?: string;
  phone: string;
  feeStatus?: 'paid' | 'due';
}

interface Stats {
  totalStudents: number;
  totalFaculty: number;
  feePaid: number;
  feeDue: number;
  expiringPasses: number;
  passesIssued: number;
}

const AdminBusDashboard = () => {
  const { busNumber } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [busDetails, setBusDetails] = useState<BusDetail | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0,
    totalFaculty: 0,
    feePaid: 0,
    feeDue: 0,
    expiringPasses: 0,
    passesIssued: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedCollege, setSelectedCollege] = useState<string>('all');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [colleges, setColleges] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [showUserList, setShowUserList] = useState(false);
  const [userListType, setUserListType] = useState<string>('');
  const [userList, setUserList] = useState<Profile[]>([]);
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [alertMessage, setAlertMessage] = useState('');

  useEffect(() => {
    if (busNumber) {
      fetchBusDetails();
      fetchFilters();
    }
  }, [busNumber]);

  useEffect(() => {
    if (busNumber) {
      fetchStats();
    }
  }, [busNumber, selectedCollege, selectedBranch, selectedYear]);

  const fetchBusDetails = async () => {
    const { data, error } = await supabase
      .from('bus_details')
      .select('*')
      .eq('bus_number', busNumber)
      .maybeSingle();

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load bus details',
        variant: 'destructive',
      });
    } else if (data) {
      setBusDetails(data);
    }
  };

  const fetchFilters = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('college, branch, year')
      .eq('bus_number', busNumber);

    if (profiles) {
      const uniqueColleges = [...new Set(profiles.map((p) => p.college).filter(Boolean))];
      const uniqueBranches = [...new Set(profiles.map((p) => p.branch).filter(Boolean))];
      const uniqueYears = [...new Set(profiles.map((p) => p.year).filter(Boolean))];

      setColleges(uniqueColleges as string[]);
      setBranches(uniqueBranches as string[]);
      setYears(uniqueYears as string[]);
    }
  };

  const fetchStats = async () => {
    setLoading(true);

    let query = supabase.from('profiles').select('id, role').eq('bus_number', busNumber);

    if (selectedCollege !== 'all') {
      query = query.eq('college', selectedCollege);
    }
    if (selectedBranch !== 'all') {
      query = query.eq('branch', selectedBranch);
    }
    if (selectedYear !== 'all') {
      query = query.eq('year', selectedYear);
    }

    const { data: profiles } = await query;

    if (profiles) {
      const students = profiles.filter((p) => p.role === 'student');
      const faculty = profiles.filter((p) => p.role === 'faculty');

      const currentMonth = new Date().toLocaleString('default', { month: 'long' });
      const currentYear = new Date().getFullYear();

      const { data: feeData } = await supabase
        .from('fee_history')
        .select('user_id, status')
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .in(
          'user_id',
          profiles.map((p) => p.id)
        );

      const feePaidCount = feeData?.filter((f) => f.status === 'paid').length || 0;
      const feeDueCount = feeData?.filter((f) => f.status === 'due').length || 0;

      const fiveDaysFromNow = new Date();
      fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

      const { data: passData } = await supabase
        .from('profiles')
        .select('id')
        .eq('bus_number', busNumber)
        .lte('pass_expiry_date', fiveDaysFromNow.toISOString().split('T')[0])
        .gte('pass_expiry_date', new Date().toISOString().split('T')[0]);

      // Fetch passes issued count
      const { data: passesIssuedData } = await supabase
        .from('passes')
        .select('user_id, profiles!inner(bus_number)')
        .not('monthly_pass_url', 'is', null);

      // Filter by bus number on the client side after joining
      const filteredPasses = passesIssuedData?.filter(
        (pass: any) => pass.profiles?.bus_number === busNumber
      );

      setStats({
        totalStudents: students.length,
        totalFaculty: faculty.length,
        feePaid: feePaidCount,
        feeDue: feeDueCount,
        expiringPasses: passData?.length || 0,
        passesIssued: filteredPasses?.length || 0,
      });
    }

    setLoading(false);
  };

  const handleStatClick = async (type: string) => {
    let query = supabase
      .from('profiles')
      .select('id, name, role, college, branch, year, phone')
      .eq('bus_number', busNumber);

    if (selectedCollege !== 'all') {
      query = query.eq('college', selectedCollege);
    }
    if (selectedBranch !== 'all') {
      query = query.eq('branch', selectedBranch);
    }
    if (selectedYear !== 'all') {
      query = query.eq('year', selectedYear);
    }

    if (type === 'students') {
      query = query.eq('role', 'student');
    } else if (type === 'faculty') {
      query = query.eq('role', 'faculty');
    }

    const { data: profiles } = await query;

    if (type === 'feePaid' || type === 'feeDue') {
      const currentMonth = new Date().toLocaleString('default', { month: 'long' });
      const currentYear = new Date().getFullYear();
      const status = type === 'feePaid' ? 'paid' : 'due';

      const { data: feeData } = await supabase
        .from('fee_history')
        .select('user_id, status')
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .eq('status', status);

      const feeUserIds = feeData?.map((f) => f.user_id) || [];
      const filteredProfiles = profiles?.filter((p) => feeUserIds.includes(p.id)).map(p => ({
        ...p,
        feeStatus: status as 'paid' | 'due'
      })) || [];
      setUserList(filteredProfiles);
    } else if (type === 'expiringPasses') {
      const fiveDaysFromNow = new Date();
      fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

      const { data: passProfiles } = await supabase
        .from('profiles')
        .select('id, name, role, college, branch, year, phone')
        .eq('bus_number', busNumber)
        .lte('pass_expiry_date', fiveDaysFromNow.toISOString().split('T')[0])
        .gte('pass_expiry_date', new Date().toISOString().split('T')[0]);

      setUserList(passProfiles || []);
    } else if (type === 'passesIssued') {
      // Fetch users who have uploaded monthly passes
      const { data: passesData } = await supabase
        .from('passes')
        .select('user_id')
        .not('monthly_pass_url', 'is', null);

      const passUserIds = passesData?.map((p) => p.user_id) || [];
      
      const { data: passProfiles } = await supabase
        .from('profiles')
        .select('id, name, role, college, branch, year, phone')
        .eq('bus_number', busNumber)
        .in('id', passUserIds);

      setUserList(passProfiles || []);
    } else {
      setUserList(profiles || []);
    }

    setUserListType(type);
    setShowUserList(true);
  };

  const handleFeeStatusChange = async (userId: string, newStatus: 'paid' | 'due') => {
    const currentMonth = new Date().toLocaleString('default', { month: 'long' });
    const currentYear = new Date().getFullYear();

    const { error } = await supabase
      .from('fee_history')
      .upsert({
        user_id: userId,
        month: currentMonth,
        year: currentYear,
        status: newStatus,
        amount: 0,
        bus_number: busNumber,
      }, {
        onConflict: 'user_id,month,year'
      });

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
      // Update local state
      setUserList(userList.map(u => 
        u.id === userId ? { ...u, feeStatus: newStatus } : u
      ));
      // Refresh stats
      fetchStats();
    }
  };

  const handleSendAlert = (user: Profile) => {
    setSelectedUser(user);
    setAlertMessage('');
    setShowAlertDialog(true);
  };

  const submitAlert = async () => {
    if (!selectedUser || !alertMessage.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an alert message',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('alerts')
      .insert({
        user_id: selectedUser.id,
        type: 'custom',
        message: alertMessage,
        status: 'unread',
      });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to send alert',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: `Alert sent to ${selectedUser.name}`,
      });
      setShowAlertDialog(false);
      setAlertMessage('');
      setSelectedUser(null);
    }
  };

  if (loading && !busDetails) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!busDetails) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Bus not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Bus {busNumber} Dashboard</h1>
          <Button onClick={() => navigate('/admin/buses')} variant="outline">
            Back to Buses
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Route Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              <span className="font-semibold">Route:</span> {busDetails.route}
            </p>
            <p>
              <span className="font-semibold">Morning Departure:</span>{' '}
              {formatTo12Hour(busDetails.departure_time)}
            </p>
            <p>
              <span className="font-semibold">Evening Arrival:</span>{' '}
              {formatTo12Hour(busDetails.arrival_time)}
            </p>
            <p>
              <span className="font-semibold">Capacity:</span> {busDetails.capacity}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">College</label>
                <Select value={selectedCollege} onValueChange={setSelectedCollege}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All Colleges</SelectItem>
                    {colleges.map((college) => (
                      <SelectItem key={college} value={college}>
                        {college}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Branch</label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch} value={branch}>
                        {branch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Year</label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All Years</SelectItem>
                    {years.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => handleStatClick('students')}
          >
            <CardHeader>
              <CardTitle className="text-lg">Students</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.totalStudents}</p>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => handleStatClick('faculty')}
          >
            <CardHeader>
              <CardTitle className="text-lg">Faculty</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.totalFaculty}</p>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => handleStatClick('feePaid')}
          >
            <CardHeader>
              <CardTitle className="text-lg">Fee Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{stats.feePaid}</p>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => handleStatClick('feeDue')}
          >
            <CardHeader>
              <CardTitle className="text-lg">Fee Due</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600">{stats.feeDue}</p>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => handleStatClick('expiringPasses')}
          >
            <CardHeader>
              <CardTitle className="text-lg">Expiring Passes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-orange-600">
                {stats.expiringPasses}
              </p>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => handleStatClick('passesIssued')}
          >
            <CardHeader>
              <CardTitle className="text-lg">Passes Issued</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">
                {stats.passesIssued}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showUserList} onOpenChange={setShowUserList}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {userListType === 'students' && 'Students List'}
              {userListType === 'faculty' && 'Faculty List'}
              {userListType === 'feePaid' && 'Fee Paid List'}
              {userListType === 'feeDue' && 'Fee Due List'}
              {userListType === 'expiringPasses' && 'Expiring Passes List'}
              {userListType === 'passesIssued' && 'Passes Issued List'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {userList.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No users found</p>
            ) : (
              userList.map((user) => (
                <Card key={user.id}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1 flex-1">
                        <Link
                          to={`/admin/user/${user.id}`}
                          className="font-semibold text-primary hover:underline"
                        >
                          {user.name}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {user.role} | {user.college}
                        </p>
                        {user.branch && (
                          <p className="text-sm text-muted-foreground">
                            {user.branch} - Year {user.year}
                          </p>
                        )}
                        <p className="text-sm">{user.phone}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        {(userListType === 'feePaid' || userListType === 'feeDue') && (
                          <div className="flex gap-2 items-center">
                            <Badge variant={user.feeStatus === 'paid' ? 'default' : 'destructive'}>
                              {user.feeStatus?.toUpperCase()}
                            </Badge>
                            <Select
                              value={user.feeStatus}
                              onValueChange={(value: 'paid' | 'due') =>
                                handleFeeStatusChange(user.id, value)
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
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSendAlert(user)}
                        >
                          Send Alert
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Alert to {selectedUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="alert-message">Alert Message</Label>
              <Textarea
                id="alert-message"
                placeholder="Enter your custom alert message..."
                value={alertMessage}
                onChange={(e) => setAlertMessage(e.target.value)}
                rows={5}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAlertDialog(false)}>
                Cancel
              </Button>
              <Button onClick={submitAlert}>Send Alert</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBusDashboard;
