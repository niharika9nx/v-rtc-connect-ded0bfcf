import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Edit2, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

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
          phone: data.phone || '',
          gender: data.gender || '',
          college: data.college || '',
          registration_id: data.registration_id || '',
          branch: data.branch || '',
          year: data.year || '',
          section: data.section || '',
          department: data.department || '',
        });
      }
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">My Profile</h1>
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} size="sm">
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            ) : (
              <Button onClick={() => setIsEditing(false)} variant="ghost" size="sm">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            {profile && !isEditing && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{profile.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Role</p>
                  <p className="font-medium capitalize">{profile.role || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{profile.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Gender</p>
                  <p className="font-medium capitalize">{profile.gender || 'N/A'}</p>
                </div>
                
                {profile.role === 'student' && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Registration ID</p>
                      <p className="font-medium">{profile.registration_id || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">College</p>
                      <p className="font-medium capitalize">{profile.college || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Branch</p>
                      <p className="font-medium uppercase">{profile.branch || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Year</p>
                      <p className="font-medium">{profile.year ? `${profile.year}${profile.year === '1' ? 'st' : profile.year === '2' ? 'nd' : profile.year === '3' ? 'rd' : 'th'} Year` : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Section</p>
                      <p className="font-medium">Section {profile.section || 'N/A'}</p>
                    </div>
                  </>
                )}

                {profile.role === 'faculty' && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">College</p>
                      <p className="font-medium capitalize">{profile.college || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Department</p>
                      <p className="font-medium uppercase">{profile.department || 'N/A'}</p>
                    </div>
                  </>
                )}

                {profile.role === 'admin' && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">College</p>
                      <p className="font-medium capitalize">{profile.college || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Department</p>
                      <p className="font-medium uppercase">{profile.department || 'N/A'}</p>
                    </div>
                  </>
                )}

                {profile.bus_number && (
                  <div>
                    <p className="text-sm text-muted-foreground">Bus Number</p>
                    <p className="font-medium">{profile.bus_number}</p>
                  </div>
                )}

                {profile.pass_expiry_date && (
                  <div>
                    <p className="text-sm text-muted-foreground">Pass Expiry Date</p>
                    <p className="font-medium">{new Date(profile.pass_expiry_date).toLocaleDateString()}</p>
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
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
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
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} />
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
                          <FormLabel>Gender</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
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
                          <FormLabel>College</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select college" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="gcet">GCET</SelectItem>
                              <SelectItem value="gips">GIPS</SelectItem>
                              <SelectItem value="gperi">GPERI</SelectItem>
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
                              <FormLabel>Registration ID</FormLabel>
                              <FormControl>
                                <Input {...field} />
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
                              <FormLabel>Branch</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select branch" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="cse">CSE</SelectItem>
                                  <SelectItem value="ece">ECE</SelectItem>
                                  <SelectItem value="eee">EEE</SelectItem>
                                  <SelectItem value="mech">MECH</SelectItem>
                                  <SelectItem value="civil">CIVIL</SelectItem>
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
                              <FormLabel>Year</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select year" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="1">1st Year</SelectItem>
                                  <SelectItem value="2">2nd Year</SelectItem>
                                  <SelectItem value="3">3rd Year</SelectItem>
                                  <SelectItem value="4">4th Year</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="section"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Section</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select section" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="A">A</SelectItem>
                                  <SelectItem value="B">B</SelectItem>
                                  <SelectItem value="C">C</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {profile.role === 'faculty' && (
                      <FormField
                        control={form.control}
                        name="department"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Department</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="cse">CSE</SelectItem>
                                <SelectItem value="ece">ECE</SelectItem>
                                <SelectItem value="eee">EEE</SelectItem>
                                <SelectItem value="mech">MECH</SelectItem>
                                <SelectItem value="civil">CIVIL</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {profile.role === 'admin' && (
                      <FormField
                        control={form.control}
                        name="department"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Department</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="cse">CSE</SelectItem>
                                <SelectItem value="ece">ECE</SelectItem>
                                <SelectItem value="eee">EEE</SelectItem>
                                <SelectItem value="mech">MECH</SelectItem>
                                <SelectItem value="civil">CIVIL</SelectItem>
                                <SelectItem value="administration">Administration</SelectItem>
                                <SelectItem value="transport">Transport</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      Save Changes
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
