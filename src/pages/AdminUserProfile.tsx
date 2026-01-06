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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Trash2, Edit2 } from 'lucide-react';
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

interface BusDetail {
  ID: string;
  bus_number: string;
  route: string;
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
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; title: string } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [identityCardSignedUrl, setIdentityCardSignedUrl] = useState<string | null>(null);
  const [monthlyPassSignedUrl, setMonthlyPassSignedUrl] = useState<string | null>(null);
  const [loadingImages, setLoadingImages] = useState(false);
  
  // Admin editing states
  const [buses, setBuses] = useState<BusDetail[]>([]);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editBusNumber, setEditBusNumber] = useState('');
  const [editSeatNumber, setEditSeatNumber] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
      fetchFeeHistory();
      fetchPassInfo();
      fetchBuses();
    }
  }, [userId]);

  const fetchBuses = async () => {
    const { data, error } = await supabase
      .from('bus_details')
      .select('ID, bus_number, route')
      .order('bus_number');
    
    if (!error && data) {
      setBuses(data as BusDetail[]);
    }
  };

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
      await fetchSignedUrls(data);
    }
  };

  const extractFilePath = (url: string): string | null => {
    if (!url) return null;
    // Check if it's already just a file path (no http)
    if (!url.startsWith('http')) {
      return url;
    }
    // Extract file path from public URL
    const match = url.match(/pass-documents\/(.+?)(\?|$)/);
    return match ? match[1] : null;
  };

  const getSignedUrl = async (filePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('get-signed-url', {
        body: { filePath, targetUserId: userId }
      });
      
      if (error) {
        console.error('Error getting signed URL:', error);
        return null;
      }
      
      return data?.signedUrl || null;
    } catch (error) {
      console.error('Error invoking get-signed-url:', error);
      return null;
    }
  };

  const fetchSignedUrls = async (passData: PassInfo) => {
    setLoadingImages(true);
    try {
      // Fetch signed URL for identity card
      if (passData.identity_card_url) {
        const filePath = extractFilePath(passData.identity_card_url);
        if (filePath) {
          const signedUrl = await getSignedUrl(filePath);
          setIdentityCardSignedUrl(signedUrl);
        }
      }
      
      // Fetch signed URL for monthly pass
      if (passData.monthly_pass_url) {
        const filePath = extractFilePath(passData.monthly_pass_url);
        if (filePath) {
          const signedUrl = await getSignedUrl(filePath);
          setMonthlyPassSignedUrl(signedUrl);
        }
      }
    } catch (error) {
      console.error('Error fetching signed URLs:', error);
    } finally {
      setLoadingImages(false);
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
    // Check if it's already a full URL
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    // Otherwise, construct the URL from the storage path
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

  const handleDeleteUser = async () => {
    if (deleteConfirmation !== 'DELETE') {
      toast({
        title: 'Error',
        description: 'Please type DELETE to confirm',
        variant: 'destructive',
      });
      return;
    }

    setIsDeleting(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        toast({
          title: 'Error',
          description: 'You must be logged in to perform this action',
          variant: 'destructive',
        });
        setIsDeleting(false);
        return;
      }

      const response = await supabase.functions.invoke('delete-user', {
        body: { userId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: 'Success',
        description: 'User deleted successfully',
      });

      // Navigate back to buses page
      navigate('/admin/buses');
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteConfirmation('');
    }
  };

  const handleOpenEditDialog = () => {
    setEditBusNumber(profile?.bus_number || 'none');
    setEditSeatNumber(profile?.seat_number?.toString() || '');
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!profile) return;
    
    setIsSavingEdit(true);
    try {
      // Handle "none" as null for bus number
      const busNumber = editBusNumber === 'none' || editBusNumber === '' ? null : editBusNumber;
      const seatNumber = editSeatNumber ? parseInt(editSeatNumber) : null;

      const { error } = await supabase
        .from('profiles')
        .update({
          bus_number: busNumber,
          seat_number: seatNumber,
        })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'User bus assignment updated successfully',
      });

      setShowEditDialog(false);
      fetchUserProfile();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update user',
        variant: 'destructive',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const getRouteForBus = (busNumber: string): string => {
    if (!busNumber || busNumber === 'none') return 'N/A';
    const bus = buses.find(b => b.bus_number === busNumber);
    return bus?.route || 'N/A';
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
          <div className="flex gap-2">
            <Button 
              onClick={() => setShowDeleteDialog(true)} 
              variant="destructive"
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete User
            </Button>
            <Button 
              onClick={() => profile?.bus_number ? navigate(`/admin/bus/${profile.bus_number}`) : navigate('/admin/buses')} 
              variant="outline"
            >
              Back
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Profile Details</CardTitle>
              <Button 
                onClick={handleOpenEditDialog}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Edit2 className="h-4 w-4" />
                Edit Bus Assignment
              </Button>
            </div>
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
                <p className="font-semibold">{profile.bus_number || 'Not Assigned'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Seat Number</p>
                <p className="font-semibold text-primary">{profile.seat_number || 'Not Assigned'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Route</p>
                <p className="font-semibold">{profile.bus_number ? getRouteForBus(profile.bus_number) : 'N/A'}</p>
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
                      loadingImages && !identityCardSignedUrl ? (
                        <div className="border rounded-lg p-8 text-center bg-muted/50 flex items-center justify-center gap-2">
                          <span className="animate-spin">⏳</span>
                          <span className="text-muted-foreground">Loading...</span>
                        </div>
                      ) : identityCardSignedUrl ? (
                        <Button
                          variant="outline"
                          className="w-full h-24 flex flex-col gap-2"
                          onClick={() => {
                            setSelectedImage({
                              url: identityCardSignedUrl,
                              title: 'Identity Card'
                            });
                            setShowImageDialog(true);
                          }}
                        >
                          <span className="text-lg">📄</span>
                          <span>View Identity Card</span>
                        </Button>
                      ) : (
                        <div className="border rounded-lg p-8 text-center bg-destructive/10 border-destructive/30">
                          <p className="text-destructive">Failed to load image</p>
                        </div>
                      )
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
                        {loadingImages && !monthlyPassSignedUrl ? (
                          <div className="border rounded-lg p-8 text-center bg-muted/50 flex items-center justify-center gap-2">
                            <span className="animate-spin">⏳</span>
                            <span className="text-muted-foreground">Loading...</span>
                          </div>
                        ) : monthlyPassSignedUrl ? (
                          <Button
                            variant="outline"
                            className="w-full h-24 flex flex-col gap-2"
                            onClick={() => {
                              setSelectedImage({
                                url: monthlyPassSignedUrl,
                                title: 'Monthly Pass'
                              });
                              setShowImageDialog(true);
                            }}
                          >
                            <span className="text-lg">🎫</span>
                            <span>View Monthly Pass</span>
                          </Button>
                        ) : (
                          <div className="border rounded-lg p-8 text-center bg-destructive/10 border-destructive/30">
                            <p className="text-destructive">Failed to load image</p>
                          </div>
                        )}
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

      {/* Image View Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">{selectedImage?.title}</DialogTitle>
          </DialogHeader>
          <div className="relative">
            {selectedImage && (
              <img
                src={selectedImage.url}
                alt={selectedImage.title}
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
              />
            )}
            {/* Status overlay for Monthly Pass */}
            {selectedImage?.title === 'Monthly Pass' && (() => {
              const passStatus = getPassStatus();
              if (passStatus.status === 'expired' || passStatus.status === 'fake') {
                return (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                    <span className="text-4xl font-bold text-red-500 transform -rotate-12">
                      {passStatus.status === 'fake' ? 'FAKE PASS' : 'EXPIRED'}
                    </span>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Delete User Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        setShowDeleteDialog(open);
        if (!open) setDeleteConfirmation('');
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg text-destructive">Delete User</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the user account for <strong>{profile?.name}</strong> and all associated data including:
              <ul className="list-disc list-inside mt-2 text-sm">
                <li>Profile information</li>
                <li>Fee history records</li>
                <li>Pass documents</li>
                <li>Bus requests</li>
                <li>Complaints and alerts</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="delete-confirmation" className="text-sm">
                Type <strong>DELETE</strong> to confirm
              </Label>
              <Input
                id="delete-confirmation"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmation('');
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteUser}
              disabled={deleteConfirmation !== 'DELETE' || isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Bus Assignment Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Bus Assignment</DialogTitle>
            <DialogDescription>
              Update the bus number, seat number, and route for {profile?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-bus-number">Bus Number</Label>
              <Select value={editBusNumber} onValueChange={setEditBusNumber}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select bus" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="none">No Bus Assigned</SelectItem>
                  {buses.map((bus) => (
                    <SelectItem key={bus.ID} value={bus.bus_number || `bus-${bus.ID}`}>
                      Bus {bus.bus_number} - {bus.route}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-seat-number">Seat Number</Label>
              <Input
                id="edit-seat-number"
                type="number"
                value={editSeatNumber}
                onChange={(e) => setEditSeatNumber(e.target.value)}
                placeholder="Enter seat number"
              />
            </div>
            {editBusNumber && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Route</p>
                <p className="font-semibold">{getRouteForBus(editBusNumber)}</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowEditDialog(false)}
              disabled={isSavingEdit}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={isSavingEdit}
            >
              {isSavingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUserProfile;
