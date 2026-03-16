import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Edit2, X, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { getColleges, getBranches, getFacultyDepartments, getYears, getSections } from '@/lib/collegeConfig';

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  phone: z.string().min(10, 'Phone must be at least 10 digits').max(15),
  gender: z.string().min(1, 'Gender is required'),
  college: z.string().min(1, 'College is required'),
  registration_id: z.string().optional(),
  branch: z.string().optional(),
  year: z.string().optional(),
  section: z.string().optional(),
  department: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      phone: '',
      gender: '',
      college: '',
      registration_id: '',
      branch: '',
      year: '',
      section: '',
      department: '',
    },
  });

  const watchedCollege = form.watch('college');
  const watchedBranch = form.watch('branch');

  // Dynamic options based on selected college
  const availableBranches = useMemo(() => getBranches(watchedCollege), [watchedCollege]);
  const availableDepartments = useMemo(() => getFacultyDepartments(watchedCollege), [watchedCollege]);
  const availableYears = useMemo(() => getYears(watchedCollege, watchedBranch), [watchedCollege, watchedBranch]);
  const availableSections = useMemo(() => getSections(watchedCollege), [watchedCollege]);

  // Reset dependent fields when college changes
  const handleCollegeChange = (value: string) => {
    form.setValue('college', value);
    form.setValue('branch', '');
    form.setValue('year', '');
    form.setValue('section', '');
    form.setValue('department', '');
  };

  // Reset year when branch changes (for colleges with branch-specific years)
  const handleBranchChange = (value: string) => {
    form.setValue('branch', value);
    form.setValue('year', '');
  };

  const fetchProfile = async () => {
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (data) {
        setProfile(data);
        form.reset({
          name: data.name || '',
          phone: String(data.phone || ''),
          gender: data.gender || '',
          college: data.college || '',
          registration_id: data.registration_id || '',
          branch: data.branch || '',
          year: data.year || '',
          section: data.section || '',
          department: data.department || '',
        });
      }

      // Check if user is admin
      const { data: adminCheck } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'admin' });
      setIsAdmin(!!adminCheck);

      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const onSubmit = async (data: ProfileFormData) => {
    try {
      const updateData: any = {
        name: data.name,
        phone: data.phone,
        gender: data.gender,
        college: data.college,
      };

      if (profile.role === 'student') {
        updateData.registration_id = data.registration_id;
        updateData.branch = data.branch;
        updateData.year = data.year;
        updateData.section = data.section;
      } else if (profile.role === 'faculty' || profile.role === 'admin') {
        updateData.department = data.department;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });

      setIsEditing(false);
      fetchProfile();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-lg text-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-mesh">
      <div className="relative overflow-hidden border-b border-border/30 glass">
        <div className="absolute inset-0 bg-gradient-accent opacity-10" />
        <div className="relative max-w-7xl mx-auto px-4 py-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate(isAdmin ? '/admin' : '/dashboard')} 
            className="mb-2 hover:bg-primary/10 border-primary/30"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold font-display text-foreground">My Profile</h1>
            </div>
            {!isEditing ? (
              <Button 
                onClick={() => setIsEditing(true)} 
                size="sm"
                className="bg-primary hover:bg-primary/90 hover:shadow-glow"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            ) : (
              <Button 
                onClick={() => setIsEditing(false)} 
                variant="ghost" 
                size="sm"
                className="hover:bg-destructive/10"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <Card className="glass border-border/50 shadow-lg hover:shadow-glow transition-all animate-slide-up">
          <CardHeader>
            <CardTitle className="text-foreground">Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            {profile && !isEditing && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium text-foreground">{profile.name || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Role</p>
                  <p className="font-medium text-foreground capitalize">{profile.role || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium text-foreground">{profile.phone || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Gender</p>
                  <p className="font-medium text-foreground capitalize">{profile.gender || 'N/A'}</p>
                </div>
                
                {profile.role === 'student' && (
                  <>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Registration ID</p>
                      <p className="font-medium text-foreground">{profile.registration_id || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">College</p>
                      <p className="font-medium text-foreground capitalize">{profile.college || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Branch</p>
                      <p className="font-medium text-foreground uppercase">{profile.branch || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Year</p>
                      <p className="font-medium text-foreground">{profile.year ? `${profile.year}${profile.year === '1' ? 'st' : profile.year === '2' ? 'nd' : profile.year === '3' ? 'rd' : 'th'} Year` : 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Section</p>
                      <p className="font-medium text-foreground">Section {profile.section || 'N/A'}</p>
                    </div>
                  </>
                )}

                {profile.role === 'faculty' && (
                  <>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">College</p>
                      <p className="font-medium text-foreground capitalize">{profile.college || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Department</p>
                      <p className="font-medium text-foreground uppercase">{profile.department || 'N/A'}</p>
                    </div>
                  </>
                )}

                {profile.role === 'admin' && (
                  <>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">College</p>
                      <p className="font-medium text-foreground capitalize">{profile.college || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Department</p>
                      <p className="font-medium text-foreground uppercase">{profile.department || 'N/A'}</p>
                    </div>
                  </>
                )}

                {profile.bus_number && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Bus Number</p>
                    <p className="font-medium text-foreground">{profile.bus_number}</p>
                  </div>
                )}

                {profile.pass_expiry_date && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Pass Expiry Date</p>
                    <p className="font-medium text-foreground">{new Date(profile.pass_expiry_date).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            )}

            {isEditing && profile && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">Name</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-muted/30 border-border/50" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">Phone</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-muted/30 border-border/50" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">Gender</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-muted/30 border-border/50">
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="college"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">College</FormLabel>
                          <Select onValueChange={handleCollegeChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-muted/30 border-border/50">
                                <SelectValue placeholder="Select college" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background z-50">
                              {getColleges().map((college) => (
                                <SelectItem key={college} value={college}>
                                  {college}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {profile.role === 'student' && (
                      <>
                        <FormField
                          control={form.control}
                          name="registration_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-foreground">Registration ID</FormLabel>
                              <FormControl>
                                <Input {...field} className="bg-muted/30 border-border/50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="branch"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-foreground">Branch</FormLabel>
                              <Select 
                                onValueChange={handleBranchChange} 
                                value={field.value}
                                disabled={!watchedCollege}
                              >
                                <FormControl>
                                  <SelectTrigger className="bg-muted/30 border-border/50">
                                    <SelectValue placeholder="Select branch" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-background z-50">
                                  {availableBranches.map((branch) => (
                                    <SelectItem key={branch} value={branch}>
                                      {branch}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="year"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-foreground">Year</FormLabel>
                              <Select 
                                onValueChange={field.onChange} 
                                value={field.value}
                                disabled={!watchedCollege || (availableYears.length === 0 && !watchedBranch)}
                              >
                                <FormControl>
                                  <SelectTrigger className="bg-muted/30 border-border/50">
                                    <SelectValue placeholder="Select year" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-background z-50">
                                  {availableYears.map((year) => (
                                    <SelectItem key={year} value={year}>
                                      Year {year}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {availableSections.length > 0 && (
                          <FormField
                            control={form.control}
                            name="section"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-foreground">Section</FormLabel>
                                <Select 
                                  onValueChange={field.onChange} 
                                  value={field.value}
                                  disabled={!watchedCollege}
                                >
                                  <FormControl>
                                    <SelectTrigger className="bg-muted/30 border-border/50">
                                      <SelectValue placeholder="Select section" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent className="bg-background z-50">
                                    {availableSections.map((section) => (
                                      <SelectItem key={section} value={section}>
                                        Section {section}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </>
                    )}

                    {(profile.role === 'faculty' || profile.role === 'admin') && (
                      <FormField
                        control={form.control}
                        name="department"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-foreground">Department</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value}
                              disabled={!watchedCollege}
                            >
                              <FormControl>
                                <SelectTrigger className="bg-muted/30 border-border/50">
                                  <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-background z-50">
                                {availableDepartments.map((dept) => (
                                  <SelectItem key={dept} value={dept}>
                                    {dept}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button 
                      type="submit" 
                      className="bg-primary hover:bg-primary/90 hover:shadow-glow"
                    >
                      Save Changes
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsEditing(false)}
                      className="border-border/50 hover:bg-muted/30"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
