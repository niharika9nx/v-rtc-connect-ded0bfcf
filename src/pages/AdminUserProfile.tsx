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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  buss_pass_id?: string;
}

interface FeeHistory {
  id?: string;
  month: string;
  year: number;
  status: string;
  amount: number;
  created_at?: string;
  isCurrentMonth?: boolean;
}

const AdminUserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [feeHistory, setFeeHistory] = useState<FeeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

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
      setLoading(false);
      return;
    }

    // Fetch bus pass ID from passes table
    const { data: passData } = await supabase
      .from('passes')
      .select('buss_pass_id')
      .eq('user_id', userId)
      .maybeSingle();

    setProfile({
      ...data,
      buss_pass_id: passData?.buss_pass_id
    });
    setLoading(false);
  };

  const fetchFeeHistory = async () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().toLocaleString('default', { month: 'long' });

    const { data, error } = await supabase
      .from('fee_history')
      .select('*')
      .eq('user_id', userId)
      .eq('year', currentYear);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load fee history',
        variant: 'destructive',
      });
      return;
    }

    // Create a map of existing fee records
    const feeMap = new Map<string, FeeHistory>();
    data?.forEach((fee) => {
      feeMap.set(fee.month, {
        id: fee.id,
        month: fee.month,
        year: fee.year,
        status: fee.status,
        amount: fee.amount,
        created_at: fee.created_at,
      });
    });

    // Generate all months with their status
    const allMonthsFees: FeeHistory[] = months.map((month) => {
      const existingFee = feeMap.get(month);
      const isCurrentMonth = month === currentMonth;
      
      if (existingFee) {
        return { ...existingFee, isCurrentMonth };
      }
      
      return {
        month,
        year: currentYear,
        status: 'due',
        amount: 0,
        isCurrentMonth,
      };
    });

    setFeeHistory(allMonthsFees);
  };

  const handleFeeStatusChange = async (month: string, newStatus: 'paid' | 'due') => {
    if (!profile) return;

    const currentYear = new Date().getFullYear();
    const fee = feeHistory.find(f => f.month === month);

    if (fee?.id) {
      // Update existing record
      const { error } = await supabase
        .from('fee_history')
        .update({ status: newStatus })
        .eq('id', fee.id);

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to update fee status',
          variant: 'destructive',
        });
        return;
      }
    } else {
      // Create new record
      const { error } = await supabase
        .from('fee_history')
        .insert({
          user_id: userId,
          month: month,
          year: currentYear,
          status: newStatus,
          amount: 0,
          bus_number: profile.bus_number,
        });

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to create fee record',
          variant: 'destructive',
        });
        return;
      }
    }

    toast({
      title: 'Success',
      description: 'Fee status updated successfully',
    });

    // Refresh fee history
    fetchFeeHistory();
  };

  const handleBulkStatusChange = async (newStatus: 'paid' | 'due') => {
    if (!profile || selectedMonths.size === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one month',
        variant: 'destructive',
      });
      return;
    }

    const currentYear = new Date().getFullYear();
    const inserts: any[] = [];

    try {
      // Process each selected month
      for (const month of Array.from(selectedMonths)) {
        const fee = feeHistory.find(f => f.month === month);
        
        if (fee?.id) {
          // Update existing record
          const { error } = await supabase
            .from('fee_history')
            .update({ status: newStatus })
            .eq('id', fee.id);
          
          if (error) throw error;
        } else {
          // Prepare new record
          inserts.push({
            user_id: userId,
            month: month,
            year: currentYear,
            status: newStatus,
            amount: 0,
            bus_number: profile.bus_number,
          });
        }
      }
      
      // Execute all inserts
      if (inserts.length > 0) {
        const { error: insertError } = await supabase
          .from('fee_history')
          .insert(inserts);
        
        if (insertError) throw insertError;
      }

      toast({
        title: 'Success',
        description: `${selectedMonths.size} month(s) marked as ${newStatus}`,
      });

      // Clear selection and refresh
      setSelectedMonths(new Set());
      setSelectAll(false);
      fetchFeeHistory();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update fee status',
        variant: 'destructive',
      });
    }
  };

  const toggleMonthSelection = (month: string) => {
    const newSelection = new Set(selectedMonths);
    if (newSelection.has(month)) {
      newSelection.delete(month);
    } else {
      newSelection.add(month);
    }
    setSelectedMonths(newSelection);
    setSelectAll(newSelection.size === feeHistory.length);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedMonths(new Set());
      setSelectAll(false);
    } else {
      setSelectedMonths(new Set(feeHistory.map(f => f.month)));
      setSelectAll(true);
    }
  };

  const downloadFeeHistoryPDF = () => {
    if (!profile) return;

    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text('Fee History Report', 14, 20);
    
    // Add student details
    doc.setFontSize(12);
    doc.text(`Name: ${profile.name}`, 14, 35);
    doc.text(`Role: ${profile.role}`, 14, 42);
    doc.text(`Registration ID: ${profile.registration_id || 'N/A'}`, 14, 49);
    doc.text(`Bus Number: ${profile.bus_number}`, 14, 56);
    doc.text(`College: ${profile.college}`, 14, 63);
    if (profile.branch) {
      doc.text(`Branch: ${profile.branch} - Year ${profile.year}`, 14, 70);
    }
    if (profile.buss_pass_id) {
      doc.text(`Bus Pass ID: ${profile.buss_pass_id}`, 14, 77);
    }
    
    // Add fee history table
    const tableData = feeHistory.map(fee => [
      fee.month,
      fee.year.toString(),
      fee.status.toUpperCase(),
      fee.isCurrentMonth ? 'Current Month' : ''
    ]);
    
    autoTable(doc, {
      startY: 85,
      head: [['Month', 'Year', 'Status', 'Notes']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 10 },
    });
    
    // Save the PDF
    doc.save(`fee-history-${profile.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: 'Success',
      description: 'Fee history PDF downloaded successfully',
    });
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
          <Button 
            onClick={() => profile?.bus_number ? navigate(`/admin/bus/${profile.bus_number}`) : navigate('/admin/buses')} 
            variant="outline"
          >
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
              {profile.buss_pass_id && (
                <div>
                  <p className="text-sm text-muted-foreground">Bus Pass ID</p>
                  <p className="font-semibold text-primary">{profile.buss_pass_id}</p>
                </div>
              )}
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <CardTitle>Fee History</CardTitle>
              <div className="flex gap-2 flex-wrap">
                {selectedMonths.size > 0 && (
                  <>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleBulkStatusChange('paid')}
                    >
                      Mark {selectedMonths.size} as Paid
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleBulkStatusChange('due')}
                    >
                      Mark {selectedMonths.size} as Due
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadFeeHistoryPDF}
                >
                  Download PDF
                </Button>
              </div>
            </div>
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
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={toggleSelectAll}
                        className="rounded border-input"
                      />
                    </TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feeHistory.map((fee, index) => (
                    <TableRow 
                      key={index}
                      className={fee.isCurrentMonth ? 'bg-accent/50' : ''}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedMonths.has(fee.month)}
                          onChange={() => toggleMonthSelection(fee.month)}
                          className="rounded border-input"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {fee.month}
                        {fee.isCurrentMonth && (
                          <Badge variant="outline" className="ml-2">
                            Current
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{fee.year}</TableCell>
                      <TableCell>
                        <Badge
                          variant={fee.status === 'paid' ? 'default' : 'destructive'}
                        >
                          {fee.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {fee.isCurrentMonth ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={fee.status === 'paid' ? 'outline' : 'default'}
                              onClick={() => handleFeeStatusChange(fee.month, 'paid')}
                            >
                              Mark Paid
                            </Button>
                            <Button
                              size="sm"
                              variant={fee.status === 'due' ? 'outline' : 'default'}
                              onClick={() => handleFeeStatusChange(fee.month, 'due')}
                            >
                              Mark Due
                            </Button>
                          </div>
                        ) : (
                          <Select
                            value={fee.status}
                            onValueChange={(value: 'paid' | 'due') =>
                              handleFeeStatusChange(fee.month, value)
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
                        )}
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
