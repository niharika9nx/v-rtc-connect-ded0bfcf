import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data }) => setProfile(data));
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">
            Welcome, {profile?.name || 'User'}
          </h1>
          <Button onClick={signOut} variant="outline">
            Logout
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Profile</CardTitle>
          </CardHeader>
          <CardContent>
            {profile && (
              <div className="space-y-2">
                <p><strong>Name:</strong> {profile.name}</p>
                <p><strong>Role:</strong> {profile.role}</p>
                <p><strong>Phone:</strong> {profile.phone}</p>
                <p><strong>Gender:</strong> {profile.gender}</p>
                {profile.role === 'student' && (
                  <>
                    <p><strong>Registration ID:</strong> {profile.registration_id}</p>
                    <p><strong>College:</strong> {profile.college}</p>
                    <p><strong>Branch:</strong> {profile.branch}</p>
                    <p><strong>Year:</strong> {profile.year}</p>
                    <p><strong>Section:</strong> {profile.section}</p>
                  </>
                )}
                {profile.role === 'faculty' && (
                  <>
                    <p><strong>College:</strong> {profile.college}</p>
                    <p><strong>Department:</strong> {profile.department}</p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">View and edit your profile</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Bus Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Check your bus information</p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>E-Pass</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Manage your bus pass</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
