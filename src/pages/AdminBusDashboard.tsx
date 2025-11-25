import { useEffect, useState, useMemo } from 'react';
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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// College configuration - same as in SignupStudent
const collegeConfig = {
  'SVECW': {
    branches: ['CSE', 'AIDS', 'AIML', 'CSE-CS', 'IT', 'ECE', 'EEE', 'CE', 'ME', 'Freshman Engineering'],
    years: { default: ['1', '2', '3', '4'] },
    sections: ['A', 'B', 'C']
  },
  'Smt. B seetha Polytechnic': {
    branches: ['Computer Engineering', 'ECE', 'EEE', 'Applied Electronics and Instrumentation Engineering'],
    years: { default: ['1', '2', '3'] },
    sections: ['A', 'B']
  },
  'VDC': {
    branches: ['BDS', 'MDS'],
    years: { 
      'BDS': ['1', '2', '3', '4', '5'],
      'MDS': ['1', '2', '3']
    },
    sections: []
  },
  'Shri vishnu college of pharmacy': {
    branches: ['B.Pharm', 'M.Pharm', 'Pharm.D', 'Pharm.D(PB)'],
    years: {
      'B.Pharm': ['1', '2', '3', '4'],
      'Pharm.D': ['1', '2', '3', '4', '5', '6'],
      'Pharm.D(PB)': ['1', '2', '3'],
      'M.Pharm': ['1', '2']
    },
    sections: []
  },
  'B V Raju college': {
    branches: ['B.Sc', 'B.Com', 'BCA', 'M.Sc', 'MCA'],
    years: {
      'B.Sc': ['1', '2', '3'],
      'B.Com': ['1', '2', '3'],
      'BCA': ['1', '2', '3'],
      'M.Sc': ['1', '2'],
      'MCA': ['1', '2']
    },
    sections: []
  }
};

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
  buss_pass_id?: string;
}

interface Stats {
  totalStudents: number;
  totalFaculty: number;
  feePaid: number;
  feeDue: number;
  expiringPasses: number;
  passesIssued: number;
  passesExpired: number;
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
    passesExpired: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedCollege, setSelectedCollege] = useState<string>('all');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');

  // Get available branches based on selected college
  const availableBranches = useMemo(() => {
    if (selectedCollege === 'all') return [];
    if (!collegeConfig[selectedCollege as keyof typeof collegeConfig]) return [];
    return collegeConfig[selectedCollege as keyof typeof collegeConfig].branches;
  }, [selectedCollege]);

  // Get available years based on selected college and branch
  const availableYears = useMemo(() => {
    if (selectedCollege === 'all') return [];
    const config = collegeConfig[selectedCollege as keyof typeof collegeConfig];
    if (!config) return [];
    const years = config.years as any;
    if (years.default) return years.default;
    if (selectedBranch !== 'all' && years[selectedBranch]) {
      return years[selectedBranch] as string[];
    }
    return [];
  }, [selectedCollege, selectedBranch]);
  const [showUserList, setShowUserList] = useState(false);
  const [userListType, setUserListType] = useState<string>('');
  const [userList, setUserList] = useState<Profile[]>([]);
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [alertMessage, setAlertMessage] = useState('');

  useEffect(() => {
    if (busNumber) {
      fetchBusDetails();
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

  // Handle college change - reset dependent filters
  const handleCollegeChange = (value: string) => {
    setSelectedCollege(value);
    setSelectedBranch('all');
    setSelectedYear('all');
  };

  // Handle branch change - reset year filter if needed
  const handleBranchChange = (value: string) => {
    setSelectedBranch(value);
    // Reset year if the new branch has different year options
    const config = selectedCollege !== 'all' && collegeConfig[selectedCollege as keyof typeof collegeConfig];
    if (config) {
      const years = (config as any).years;
      if (!years.default) {
        setSelectedYear('all');
      }
    }
  };

  const clearFilters = () => {
    setSelectedCollege('all');
    setSelectedBranch('all');
    setSelectedYear('all');
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

      // Fetch passes issued count - first get filtered profile IDs, then count passes
      const passesIssuedUserIds = profiles.map(p => p.id);
      
      const { data: passesIssuedData } = await supabase
        .from('passes')
        .select('user_id')
        .in('user_id', passesIssuedUserIds)
        .not('monthly_pass_url', 'is', null);

      const filteredPasses = passesIssuedData || [];

      // Fetch passes expired count (users who answered "No" to pass renewal) - use filtered profile IDs
      const { data: expiredAlertsData } = await supabase
        .from('alerts')
        .select('user_id')
        .in('user_id', passesIssuedUserIds)
        .eq('type', 'pass_renewal_reminder')
        .eq('user_response', 'no')
        .eq('status', 'pending');

      const filteredExpiredAlerts = expiredAlertsData || [];

      setStats({
        totalStudents: students.length,
        totalFaculty: faculty.length,
        feePaid: feePaidCount,
        feeDue: feeDueCount,
        expiringPasses: passData?.length || 0,
        passesIssued: filteredPasses?.length || 0,
        passesExpired: filteredExpiredAlerts?.length || 0,
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

    // Fetch bus pass IDs for all users
    let profilesWithPassIds = profiles || [];
    if (profiles && profiles.length > 0) {
      const userIds = profiles.map(p => p.id);
      const { data: passesData } = await supabase
        .from('passes')
        .select('user_id, buss_pass_id')
        .in('user_id', userIds);

      const passIdMap = new Map(passesData?.map(p => [p.user_id, p.buss_pass_id]) || []);
      profilesWithPassIds = profiles.map(p => ({
        ...p,
        buss_pass_id: passIdMap.get(p.id)
      }));
    }

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
      const filteredProfiles = profilesWithPassIds?.filter((p) => feeUserIds.includes(p.id)).map(p => ({
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

      // Fetch bus pass IDs for expiring passes
      let expiringWithPassIds = passProfiles || [];
      if (passProfiles && passProfiles.length > 0) {
        const userIds = passProfiles.map(p => p.id);
        const { data: passesData } = await supabase
          .from('passes')
          .select('user_id, buss_pass_id')
          .in('user_id', userIds);

        const passIdMap = new Map(passesData?.map(p => [p.user_id, p.buss_pass_id]) || []);
        expiringWithPassIds = passProfiles.map(p => ({
          ...p,
          buss_pass_id: passIdMap.get(p.id)
        }));
      }

      setUserList(expiringWithPassIds);
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

      // Fetch bus pass IDs for issued passes
      let issuedWithPassIds = passProfiles || [];
      if (passProfiles && passProfiles.length > 0) {
        const userIds = passProfiles.map(p => p.id);
        const { data: passIdData } = await supabase
          .from('passes')
          .select('user_id, buss_pass_id')
          .in('user_id', userIds);

        const passIdMap = new Map(passIdData?.map(p => [p.user_id, p.buss_pass_id]) || []);
        issuedWithPassIds = passProfiles.map(p => ({
          ...p,
          buss_pass_id: passIdMap.get(p.id)
        }));
      }

      setUserList(issuedWithPassIds);
    } else if (type === 'passesExpired') {
      // Fetch users who answered "No" to pass renewal reminder
      const { data: expiredAlertsData } = await supabase
        .from('alerts')
        .select('user_id')
        .eq('type', 'pass_renewal_reminder')
        .eq('user_response', 'no')
        .eq('status', 'pending');

      const expiredUserIds = expiredAlertsData?.map((a) => a.user_id) || [];
      
      const { data: expiredProfiles } = await supabase
        .from('profiles')
        .select('id, name, role, college, branch, year, phone')
        .eq('bus_number', busNumber)
        .in('id', expiredUserIds);

      // Fetch bus pass IDs for expired passes
      let expiredWithPassIds = expiredProfiles || [];
      if (expiredProfiles && expiredProfiles.length > 0) {
        const userIds = expiredProfiles.map(p => p.id);
        const { data: passesData } = await supabase
          .from('passes')
          .select('user_id, buss_pass_id')
          .in('user_id', userIds);

        const passIdMap = new Map(passesData?.map(p => [p.user_id, p.buss_pass_id]) || []);
        expiredWithPassIds = expiredProfiles.map(p => ({
          ...p,
          buss_pass_id: passIdMap.get(p.id)
        }));
      }

      setUserList(expiredWithPassIds);
    } else {
      setUserList(profilesWithPassIds || []);
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

  const downloadBulkFeeReport = async () => {
    if (!busDetails) return;

    // Fetch all users on this bus
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

    const { data: profiles } = await query;

    if (!profiles || profiles.length === 0) {
      toast({
        title: 'No Data',
        description: 'No users found for the selected filters',
        variant: 'destructive',
      });
      return;
    }

    // Fetch fee history for all users
    const currentYear = new Date().getFullYear();
    const { data: feeData } = await supabase
      .from('fee_history')
      .select('*')
      .eq('year', currentYear)
      .in('user_id', profiles.map(p => p.id));

    // Fetch bus pass IDs
    const { data: passData } = await supabase
      .from('passes')
      .select('user_id, buss_pass_id')
      .in('user_id', profiles.map(p => p.id));

    const passIdMap = new Map(passData?.map(p => [p.user_id, p.buss_pass_id]) || []);

    const doc = new jsPDF('landscape');
    
    // Add title
    doc.setFontSize(18);
    doc.text(`Bus ${busNumber} - Fee History Report`, 14, 20);
    
    // Add bus details
    doc.setFontSize(12);
    doc.text(`Route: ${busDetails.route}`, 14, 30);
    doc.text(`Departure: ${formatTo12Hour(busDetails.departure_time)} | Arrival: ${formatTo12Hour(busDetails.arrival_time)}`, 14, 37);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 44);
    
    // Prepare table data
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const tableData = profiles.map(profile => {
      const userFees = feeData?.filter(f => f.user_id === profile.id) || [];
      const feeMap = new Map(userFees.map(f => [f.month, f.status]));
      
      const monthStatuses = months.map(month => {
        const status = feeMap.get(month);
        return status ? status.charAt(0).toUpperCase() : '-';
      });

      return [
        profile.name,
        profile.role,
        profile.college,
        profile.branch || '-',
        profile.year || '-',
        passIdMap.get(profile.id) || '-',
        ...monthStatuses
      ];
    });

    // Create table
    autoTable(doc, {
      startY: 52,
      head: [['Name', 'Role', 'College', 'Branch', 'Year', 'Pass ID', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 15 },
        2: { cellWidth: 25 },
        3: { cellWidth: 20 },
        4: { cellWidth: 12 },
        5: { cellWidth: 25 },
      },
    });
    
    // Add legend
    const finalY = (doc as any).lastAutoTable.finalY || 52;
    doc.setFontSize(10);
    doc.text('Legend: P = Paid, D = Due, - = No Record', 14, finalY + 10);
    
    // Save the PDF
    doc.save(`bus-${busNumber}-fee-report-${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: 'Success',
      description: 'Bulk fee report downloaded successfully',
    });
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
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-bold">Bus {busNumber} Dashboard</h1>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={downloadBulkFeeReport} variant="outline" className="flex-1 sm:flex-initial">
              Download Fee Report
            </Button>
            <Button onClick={() => navigate('/admin/buses')} variant="outline" className="flex-1 sm:flex-initial">
              Back to Buses
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Route Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 md:space-y-3">
            <p className="text-sm md:text-base">
              <span className="font-semibold">Route:</span> {busDetails.route}
            </p>
            <p className="text-sm md:text-base">
              <span className="font-semibold">Morning Departure:</span>{' '}
              {formatTo12Hour(busDetails.departure_time)}
            </p>
            <p className="text-sm md:text-base">
              <span className="font-semibold">Evening Arrival:</span>{' '}
              {formatTo12Hour(busDetails.arrival_time)}
            </p>
            <p className="text-sm md:text-base">
              <span className="font-semibold">Capacity:</span> {busDetails.capacity}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <CardTitle className="text-lg md:text-xl">Filters</CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={clearFilters}
              disabled={selectedCollege === 'all' && selectedBranch === 'all' && selectedYear === 'all'}
              className="w-full sm:w-auto"
            >
              Clear Filters
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">College</label>
                <Select value={selectedCollege} onValueChange={handleCollegeChange}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All Colleges</SelectItem>
                    {Object.keys(collegeConfig).map((college) => (
                      <SelectItem key={college} value={college}>
                        {college}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Branch</label>
                <Select 
                  value={selectedBranch} 
                  onValueChange={handleBranchChange}
                  disabled={selectedCollege === 'all'}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All Branches</SelectItem>
                    {availableBranches.map((branch) => (
                      <SelectItem key={branch} value={branch}>
                        {branch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Year</label>
                <Select 
                  value={selectedYear} 
                  onValueChange={setSelectedYear}
                  disabled={selectedCollege === 'all' || (availableYears.length === 0 && selectedBranch === 'all')}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All Years</SelectItem>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year}>
                        Year {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => handleStatClick('students')}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base md:text-lg">Students</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl md:text-3xl font-bold">{stats.totalStudents}</p>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => handleStatClick('faculty')}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base md:text-lg">Faculty</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl md:text-3xl font-bold">{stats.totalFaculty}</p>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => handleStatClick('feePaid')}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base md:text-lg">Fee Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl md:text-3xl font-bold text-green-600">{stats.feePaid}</p>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => handleStatClick('feeDue')}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base md:text-lg">Fee Due</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl md:text-3xl font-bold text-red-600">{stats.feeDue}</p>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => handleStatClick('expiringPasses')}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base md:text-lg">Expiring Passes &lt;= 5 days</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl md:text-3xl font-bold text-orange-600">
                {stats.expiringPasses}
              </p>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => handleStatClick('passesIssued')}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base md:text-lg">Passes Issued</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl md:text-3xl font-bold text-blue-600">
                {stats.passesIssued}
              </p>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => handleStatClick('passesExpired')}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base md:text-lg">Passes Expired</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl md:text-3xl font-bold text-red-600">
                {stats.passesExpired}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showUserList} onOpenChange={setShowUserList}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">
              {userListType === 'students' && 'Students List'}
              {userListType === 'faculty' && 'Faculty List'}
              {userListType === 'feePaid' && 'Fee Paid List'}
              {userListType === 'feeDue' && 'Fee Due List'}
              {userListType === 'expiringPasses' && 'Expiring Passes <= 5 days List'}
              {userListType === 'passesIssued' && 'Passes Issued List'}
              {userListType === 'passesExpired' && 'Passes Expired - Awaiting New Pass'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 md:space-y-3">
            {userList.length === 0 ? (
              <p className="text-muted-foreground text-center py-4 text-sm md:text-base">No users found</p>
            ) : (
              userList.map((user) => (
                <Card key={user.id}>
                  <CardContent className="pt-3 md:pt-4 p-3 md:p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
                      <div className="space-y-1 flex-1 w-full">
                        <Link
                          to={`/admin/user/${user.id}`}
                          className="font-semibold text-primary hover:underline text-sm md:text-base"
                        >
                          {user.name}
                        </Link>
                        <p className="text-xs md:text-sm text-muted-foreground">
                          {user.role} | {user.college}
                        </p>
                        {user.branch && (
                          <p className="text-xs md:text-sm text-muted-foreground">
                            {user.branch} - Year {user.year}
                          </p>
                        )}
                        <p className="text-xs md:text-sm">{user.phone}</p>
                        {user.buss_pass_id && (
                          <p className="text-xs md:text-sm font-medium">
                            Pass ID: <span className="text-primary">{user.buss_pass_id}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 w-full sm:w-auto">
                        {(userListType === 'feePaid' || userListType === 'feeDue') && (
                          <div className="flex gap-2 items-center flex-wrap">
                            <Badge variant={user.feeStatus === 'paid' ? 'default' : 'destructive'} className="text-xs">
                              {user.feeStatus?.toUpperCase()}
                            </Badge>
                            <Select
                              value={user.feeStatus}
                              onValueChange={(value: 'paid' | 'due') =>
                                handleFeeStatusChange(user.id, value)
                              }
                            >
                              <SelectTrigger className="w-full sm:w-[100px] bg-background text-xs md:text-sm">
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
                          className="w-full sm:w-auto text-xs md:text-sm"
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
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">Send Alert to {selectedUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 md:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="alert-message" className="text-sm md:text-base">Alert Message</Label>
              <Textarea
                id="alert-message"
                placeholder="Enter your custom alert message..."
                value={alertMessage}
                onChange={(e) => setAlertMessage(e.target.value)}
                rows={5}
                className="text-sm md:text-base"
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAlertDialog(false)} className="w-full sm:w-auto text-sm md:text-base">
                Cancel
              </Button>
              <Button onClick={submitAlert} className="w-full sm:w-auto text-sm md:text-base">Send Alert</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBusDashboard;
