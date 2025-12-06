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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import vishnuLogo from '@/assets/vishnu-logo.png';

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
  seat_number?: number;
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

interface PassInfo {
  monthly_pass_url: string | null;
  identity_card_url: string | null;
  expiry_date: string | null;
  verified: boolean | null;
  buss_pass_id: string | null;
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
  const [passInfo, setPassInfo] = useState<PassInfo | null>(null);
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
      fetchFeeHistory();
      fetchPassInfo();
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

  const fetchPassInfo = async () => {
    const { data, error } = await supabase
      .from('passes')
      .select('monthly_pass_url, identity_card_url, expiry_date, verified, buss_pass_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data) {
      setPassInfo(data);
    }
  };

  const getPassStatus = (): { status: 'expired' | 'expiring' | 'fake' | 'valid' | null; message: string } => {
    if (!passInfo) return { status: null, message: '' };
    
    // Check if pass is fake (duplicate ID detected)
    if (passInfo.verified === false) {
      return { status: 'fake', message: 'FAKE PASS - Duplicate ID Detected' };
    }
    
    // Check expiry
    if (passInfo.expiry_date) {
      const expiryDate = new Date(passInfo.expiry_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        return { status: 'expired', message: 'PASS EXPIRED' };
      } else if (diffDays <= 5) {
        return { status: 'expiring', message: `ABOUT TO EXPIRE (${diffDays} day${diffDays === 1 ? '' : 's'} left)` };
      }
    }
    
    return { status: 'valid', message: '' };
  };

  const getPassImageUrl = (path: string | null): string | null => {
    if (!path) return null;
    const { data } = supabase.storage.from('pass-documents').getPublicUrl(path);
    return data?.publicUrl || null;
  };

  const handleSendNoPassAlert = async () => {
    if (!alertMessage.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an alert message',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase.from('alerts').insert({
      user_id: userId,
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
        description: 'Alert sent successfully',
      });
      setShowAlertDialog(false);
      setAlertMessage('');
    }
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
    
    // Add logo and header
    const img = new Image();
    img.src = vishnuLogo;
    doc.addImage(img, 'PNG', 14, 10, 30, 30);
    
    // Add organization name header
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Shri Vishnu Educational Society (SVES)', 105, 20, { align: 'center' });
    
    // Add title
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Fee History Report', 105, 30, { align: 'center' });
    doc.setFont(undefined, 'normal');
    
    // Add student details
    doc.setFontSize(11);
    doc.text(`Name: ${profile.name}`, 14, 50);
    doc.text(`Role: ${profile.role}`, 14, 57);
    
    if (profile.role === 'student') {
      doc.text(`Registration ID: ${profile.registration_id || 'N/A'}`, 14, 64);
    } else if (profile.role === 'faculty') {
      doc.text(`Phone Number: ${profile.phone}`, 14, 64);
    }
    
    doc.text(`Bus Number: ${profile.bus_number}`, 14, 71);
    
    if (profile.seat_number) {
      doc.text(`Seat Number: ${profile.seat_number}`, 14, 78);
    }
    
    let currentY = profile.seat_number ? 85 : 78;
    
    if (profile.role === 'faculty' && profile.department) {
      doc.text(`Department: ${profile.department}`, 14, currentY);
      currentY += 7;
    }
    
    doc.text(`College: ${profile.college}`, 14, currentY);
    currentY += 7;
    
    if (profile.branch && profile.role === 'student') {
      doc.text(`Branch: ${profile.branch} - Year ${profile.year}`, 14, currentY);
      currentY += 7;
    }
    
    if (profile.buss_pass_id) {
      doc.text(`Bus Pass ID: ${profile.buss_pass_id}`, 14, currentY);
      currentY += 7;
    }
    
    const tableStartY = currentY + 8;
    
    // Add fee history table
    const tableData = feeHistory.map(fee => [
      fee.month,
      fee.year.toString(),
      fee.status.toUpperCase(),
      fee.isCurrentMonth ? 'Current Month' : ''
    ]);
    
    autoTable(doc, {
      startY: tableStartY,
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
              {profile.seat_number && (
                <div>
                  <p className="text-sm text-muted-foreground">Seat Number</p>
                  <p className="font-semibold text-primary">{profile.seat_number}</p>
                </div>
              )}
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

        {/* Pass Documents Section */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <CardTitle>Pass Documents</CardTitle>
              {(!passInfo?.monthly_pass_url && !passInfo?.identity_card_url) && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setShowAlertDialog(true)}
                >
                  Send Alert (No Pass Uploaded)
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {(!passInfo?.monthly_pass_url && !passInfo?.identity_card_url) ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No pass documents uploaded by this user</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Pass Status Banner */}
                {(() => {
                  const passStatus = getPassStatus();
                  if (passStatus.status && passStatus.status !== 'valid') {
                    return (
                      <div className={`p-4 rounded-lg text-center font-bold text-lg ${
                        passStatus.status === 'fake' 
                          ? 'bg-destructive/20 text-destructive border-2 border-destructive' 
                          : passStatus.status === 'expired' 
                            ? 'bg-destructive/20 text-destructive border-2 border-destructive'
                            : 'bg-orange-500/20 text-orange-600 border-2 border-orange-500'
                      }`}>
                        {passStatus.message}
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Identity Card */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg">Identity Card</h3>
                    {passInfo?.identity_card_url ? (
                      <div className="border rounded-lg overflow-hidden">
                        <img
                          src={getPassImageUrl(passInfo.identity_card_url) || ''}
                          alt="Identity Card"
                          className="w-full h-auto max-h-80 object-contain bg-muted"
                        />
                      </div>
                    ) : (
                      <div className="border rounded-lg p-8 text-center bg-muted/50">
                        <p className="text-muted-foreground">No identity card uploaded</p>
                      </div>
                    )}
                  </div>

                  {/* Monthly Pass */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg">Monthly Pass</h3>
                    {passInfo?.monthly_pass_url ? (
                      <div className="space-y-2">
                        <div className="border rounded-lg overflow-hidden relative">
                          <img
                            src={getPassImageUrl(passInfo.monthly_pass_url) || ''}
                            alt="Monthly Pass"
                            className="w-full h-auto max-h-80 object-contain bg-muted"
                          />
                          {/* Status overlay */}
                          {(() => {
                            const passStatus = getPassStatus();
                            if (passStatus.status === 'expired' || passStatus.status === 'fake') {
                              return (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                  <span className={`text-2xl font-bold ${
                                    passStatus.status === 'fake' ? 'text-red-500' : 'text-red-500'
                                  } transform -rotate-12`}>
                                    {passStatus.status === 'fake' ? 'FAKE PASS' : 'EXPIRED'}
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        {passInfo.buss_pass_id && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Pass ID:</span>{' '}
                            <span className="font-semibold text-primary">{passInfo.buss_pass_id}</span>
                          </p>
                        )}
                        {passInfo.expiry_date && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Expiry Date:</span>{' '}
                            <span className="font-semibold">{new Date(passInfo.expiry_date).toLocaleDateString()}</span>
                          </p>
                        )}
                        {passInfo.verified !== null && (
                          <Badge variant={passInfo.verified ? 'default' : 'destructive'}>
                            {passInfo.verified ? 'Verified' : 'Unverified (Fake)'}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <div className="border rounded-lg p-8 text-center bg-muted/50">
                        <p className="text-muted-foreground">No monthly pass uploaded</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alert Dialog */}
      <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">Send Alert to {profile?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 md:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="alert-message" className="text-sm md:text-base">Alert Message</Label>
              <Textarea
                id="alert-message"
                placeholder="Enter your alert message (e.g., Please upload your bus pass documents)..."
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
              <Button onClick={handleSendNoPassAlert} className="w-full sm:w-auto text-sm md:text-base">Send Alert</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUserProfile;
