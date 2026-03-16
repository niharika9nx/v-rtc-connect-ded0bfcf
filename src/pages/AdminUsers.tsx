import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, ArrowLeft, Users, GraduationCap, User } from 'lucide-react';

interface UserProfile {
  id: string;
  name: string;
  role: string;
  college: string;
  branch?: string;
  year?: string;
  department?: string;
  phone: string | number;
  bus_number?: string;
  seat_number?: number;
  feeStatus?: 'paid' | 'due' | 'none';
}

const AdminUsers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [faculty, setFaculty] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentSearch, setStudentSearch] = useState('');
  const [facultySearch, setFacultySearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState('students');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    
    // Fetch all profiles
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['student', 'faculty'])
      .order('name');

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    if (profiles && profiles.length > 0) {
      // Fetch current month fee status for all users
      const currentMonth = new Date().toLocaleString('default', { month: 'long' });
      const currentYear = new Date().getFullYear();
      
      const { data: feeData } = await supabase
        .from('fee_history')
        .select('user_id, status')
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .in('user_id', profiles.map(p => p.id));

      const feeMap = new Map(feeData?.map(f => [f.user_id, f.status]) || []);

      const usersWithFeeStatus: UserProfile[] = profiles.map(p => ({
        id: p.id,
        name: p.name || '',
        role: p.role || '',
        college: p.college || '',
        branch: p.branch || undefined,
        year: p.year || undefined,
        department: p.department || undefined,
        phone: p.phone || '',
        bus_number: p.bus_number || undefined,
        seat_number: p.seat_number || undefined,
        feeStatus: (feeMap.get(p.id) as 'paid' | 'due') || 'none'
      }));

      setStudents(usersWithFeeStatus.filter(p => p.role === 'student'));
      setFaculty(usersWithFeeStatus.filter(p => p.role === 'faculty'));
    }

    setLoading(false);
  };

  const filteredStudents = students.filter(s => 
    s.name?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const filteredFaculty = faculty.filter(f => 
    f.name?.toLowerCase().includes(facultySearch.toLowerCase())
  );

  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUsers(newSelection);
  };

  const selectAllInTab = () => {
    const users = activeTab === 'students' ? filteredStudents : filteredFaculty;
    const allSelected = users.every(u => selectedUsers.has(u.id));
    
    const newSelection = new Set(selectedUsers);
    if (allSelected) {
      users.forEach(u => newSelection.delete(u.id));
    } else {
      users.forEach(u => newSelection.add(u.id));
    }
    setSelectedUsers(newSelection);
  };

  const handleBulkDelete = async () => {
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

      let successCount = 0;
      let errorCount = 0;

      for (const userId of Array.from(selectedUsers)) {
        const response = await supabase.functions.invoke('delete-user', {
          body: { userId },
        });

        if (response.error || response.data?.error) {
          errorCount++;
        } else {
          successCount++;
        }
      }

      toast({
        title: successCount > 0 ? 'Success' : 'Error',
        description: `Deleted ${successCount} user(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
        variant: errorCount > 0 && successCount === 0 ? 'destructive' : 'default',
      });

      setSelectedUsers(new Set());
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting users:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete users',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteConfirmation('');
    }
  };

  const UserCard = ({ user }: { user: UserProfile }) => (
    <Card className="glass border-border/50 hover:shadow-glow transition-all">
      <CardContent className="pt-4 p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selectedUsers.has(user.id)}
            onCheckedChange={() => toggleUserSelection(user.id)}
            className="mt-1"
          />
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between">
              <Link
                to={`/admin/user/${user.id}`}
                className="font-semibold text-primary hover:underline"
              >
                {user.name}
              </Link>
              <Badge 
                variant={user.feeStatus === 'paid' ? 'default' : user.feeStatus === 'due' ? 'destructive' : 'secondary'}
                className="text-xs"
              >
                {user.feeStatus === 'none' ? 'No Fee Record' : user.feeStatus?.toUpperCase()}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">College:</span>{' '}
                <span className="text-foreground">{user.college || 'N/A'}</span>
              </div>
              {user.role === 'student' && user.branch && (
                <div>
                  <span className="text-muted-foreground">Branch:</span>{' '}
                  <span className="text-foreground">{user.branch} - Year {user.year}</span>
                </div>
              )}
              {user.role === 'faculty' && user.department && (
                <div>
                  <span className="text-muted-foreground">Department:</span>{' '}
                  <span className="text-foreground">{user.department}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Bus:</span>{' '}
                {user.bus_number ? (
                  <span className="text-primary font-medium">{user.bus_number}</span>
                ) : (
                  <span className="text-destructive">Not Assigned</span>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Seat:</span>{' '}
                {user.seat_number ? (
                  <span className="text-primary font-medium">{user.seat_number}</span>
                ) : (
                  <span className="text-destructive">Not Assigned</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const currentUsers = activeTab === 'students' ? filteredStudents : filteredFaculty;
  const allCurrentSelected = currentUsers.length > 0 && currentUsers.every(u => selectedUsers.has(u.id));

  return (
    <div className="min-h-screen bg-background bg-mesh p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold font-display">All Users</h1>
          </div>
          {selectedUsers.size > 0 && (
            <Button 
              variant="destructive" 
              onClick={() => setShowDeleteDialog(true)}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected ({selectedUsers.size})
            </Button>
          )}
        </div>

        <Card className="glass border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted/30">
                <GraduationCap className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{students.length}</p>
                <p className="text-sm text-muted-foreground">Students</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/30">
                <User className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{faculty.length}</p>
                <p className="text-sm text-muted-foreground">Faculty</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="students" onValueChange={setActiveTab}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <TabsList className="glass">
              <TabsTrigger value="students" className="gap-2">
                <GraduationCap className="h-4 w-4" />
                Students ({students.length})
              </TabsTrigger>
              <TabsTrigger value="faculty" className="gap-2">
                <User className="h-4 w-4" />
                Faculty ({faculty.length})
              </TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm" onClick={selectAllInTab}>
              {allCurrentSelected ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          <TabsContent value="students" className="mt-4 space-y-4">
            <Input
              placeholder="Search students by name..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="bg-background"
            />
            <ScrollArea className="h-[60vh]">
              <div className="space-y-3 pr-4">
                {filteredStudents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No students found</p>
                ) : (
                  filteredStudents.map(user => <UserCard key={user.id} user={user} />)
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="faculty" className="mt-4 space-y-4">
            <Input
              placeholder="Search faculty by name..."
              value={facultySearch}
              onChange={(e) => setFacultySearch(e.target.value)}
              className="bg-background"
            />
            <ScrollArea className="h-[60vh]">
              <div className="space-y-3 pr-4">
                {filteredFaculty.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No faculty found</p>
                ) : (
                  filteredFaculty.map(user => <UserCard key={user.id} user={user} />)
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        setShowDeleteDialog(open);
        if (!open) setDeleteConfirmation('');
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md glass border-border/50">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete {selectedUsers.size} User(s)</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the selected user accounts and all associated data including:
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
              <label className="text-sm">
                Type <strong>DELETE</strong> to confirm
              </label>
              <Input
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Type DELETE to confirm"
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
              onClick={handleBulkDelete}
              disabled={deleteConfirmation !== 'DELETE' || isDeleting}
            >
              {isDeleting ? 'Deleting...' : `Delete ${selectedUsers.size} User(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;
