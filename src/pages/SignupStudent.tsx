import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Bus } from 'lucide-react';

const SignupStudent = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    gender: '',
    registrationId: '',
    college: '',
    branch: '',
    year: '',
    section: '',
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          name: formData.name,
          phone: formData.phone,
          gender: formData.gender,
          role: 'student',
        },
      },
    });

    if (error) {
      toast({
        title: 'Signup Failed',
        description: error.message,
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    if (data.user) {
      // Insert role into user_roles table
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: data.user.id,
          role: 'student',
        });

      if (roleError) {
        console.error('Role insert error:', roleError);
      }

      // Update additional profile fields
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          registration_id: formData.registrationId,
          college: formData.college,
          branch: formData.branch,
          year: formData.year,
          section: formData.section,
        })
        .eq('id', data.user.id);

      if (updateError) {
        console.error('Profile update error:', updateError);
      }

      toast({
        title: 'Account Created',
        description: 'Please check your email to verify your account.',
      });
      
      navigate('/login');
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-mesh p-4">
      <div className="absolute inset-0 bg-gradient-primary opacity-5" />
      <Card className="w-full max-w-2xl glass border-border/50 shadow-lg hover:shadow-glow transition-all animate-slide-up relative">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10 border border-primary/30">
              <Bus className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-display text-foreground">Student Registration</CardTitle>
          <CardDescription className="text-muted-foreground">Create your student account for VBus</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="bg-muted/30 border-border/50 text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="bg-muted/30 border-border/50 text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="bg-muted/30 border-border/50 text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-foreground">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  className="bg-muted/30 border-border/50 text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender" className="text-foreground">Gender</Label>
                <Select onValueChange={(value) => setFormData({ ...formData, gender: value })}>
                  <SelectTrigger className="bg-muted/30 border-border/50">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="registrationId" className="text-foreground">Registration ID</Label>
                <Input
                  id="registrationId"
                  value={formData.registrationId}
                  onChange={(e) => setFormData({ ...formData, registrationId: e.target.value })}
                  required
                  className="bg-muted/30 border-border/50 text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="college" className="text-foreground">College</Label>
                <Select onValueChange={(value) => setFormData({ ...formData, college: value })}>
                  <SelectTrigger className="bg-muted/30 border-border/50">
                    <SelectValue placeholder="Select college" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="engineering">Engineering College</SelectItem>
                    <SelectItem value="arts">Arts College</SelectItem>
                    <SelectItem value="science">Science College</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch" className="text-foreground">Branch</Label>
                <Select onValueChange={(value) => setFormData({ ...formData, branch: value })}>
                  <SelectTrigger className="bg-muted/30 border-border/50">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cse">Computer Science</SelectItem>
                    <SelectItem value="ece">Electronics</SelectItem>
                    <SelectItem value="mech">Mechanical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="year" className="text-foreground">Year</Label>
                <Select onValueChange={(value) => setFormData({ ...formData, year: value })}>
                  <SelectTrigger className="bg-muted/30 border-border/50">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1st Year</SelectItem>
                    <SelectItem value="2">2nd Year</SelectItem>
                    <SelectItem value="3">3rd Year</SelectItem>
                    <SelectItem value="4">4th Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="section" className="text-foreground">Section</Label>
                <Select onValueChange={(value) => setFormData({ ...formData, section: value })}>
                  <SelectTrigger className="bg-muted/30 border-border/50">
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Section A</SelectItem>
                    <SelectItem value="B">Section B</SelectItem>
                    <SelectItem value="C">Section C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90 hover:shadow-glow" 
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <p className="text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary underline hover:text-primary/90 font-semibold">
                Login
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SignupStudent;
