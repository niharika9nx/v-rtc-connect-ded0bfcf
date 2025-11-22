import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

const ExpiredPassLetter = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => setProfile(data));
    }
  }, [user]);

  const currentDate = format(new Date(), 'MMMM dd, yyyy');

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card className="border-2">
          <CardContent className="p-8 md:p-12">
            <div className="space-y-6 text-foreground">
              {/* Header */}
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold mb-2">VBus College Transport System</h1>
                <p className="text-sm text-muted-foreground">Official Communication</p>
              </div>

              {/* Date */}
              <div className="text-right">
                <p className="text-sm">Date: {currentDate}</p>
              </div>

              {/* Subject */}
              <div>
                <p className="font-semibold">Subject: <span className="font-normal">Bus Pass Expiration Notice</span></p>
              </div>

              {/* Recipient */}
              <div>
                <p>To,</p>
                <p className="font-semibold">{profile?.name || 'Student/Faculty'}</p>
                <p>{profile?.registration_id || 'N/A'}</p>
                <p>{profile?.college || 'N/A'}</p>
                {profile?.department && <p>Department: {profile.department}</p>}
                {profile?.branch && <p>Branch: {profile.branch}</p>}
              </div>

              {/* Letter Body */}
              <div className="space-y-4 text-justify">
                <p>Dear {profile?.name || 'User'},</p>

                <p>
                  This is to inform you that your bus pass for the VBus College Transport System has expired. 
                  According to our records, your pass expired on{' '}
                  <span className="font-semibold">
                    {profile?.pass_expiry_date 
                      ? format(new Date(profile.pass_expiry_date), 'MMMM dd, yyyy')
                      : 'the specified date'
                    }
                  </span>.
                </p>

                <p>
                  As per the college transportation policy, an expired pass is not valid for boarding 
                  the college bus services. We request you to renew your pass at the earliest to continue 
                  availing the transportation facility.
                </p>

                <p className="font-semibold">
                  Steps to Renew Your Pass:
                </p>

                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>Upload your new monthly pass through the E-Pass section in your dashboard</li>
                  <li>Ensure the pass image is clear and all details are visible</li>
                  <li>Update your identity card if there have been any changes</li>
                  <li>Wait for admin verification (usually within 24 hours)</li>
                  <li>Pay the monthly fee if any dues are pending</li>
                </ol>

                <p>
                  Until your pass is renewed and verified, you may not be permitted to board the bus. 
                  For any queries or assistance regarding pass renewal, please contact the transport 
                  admin through the "Report an Issue" section on your dashboard or visit the 
                  administrative office.
                </p>

                <p>
                  We appreciate your cooperation and prompt action in this matter.
                </p>
              </div>

              {/* Footer */}
              <div className="mt-8 pt-6 border-t">
                <p className="font-semibold">VBus Transport Administration</p>
                <p className="text-sm text-muted-foreground">College Transport Management System</p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-6">
                <Button 
                  onClick={() => navigate('/epass')}
                  className="flex-1"
                >
                  Upload New Pass
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.print()}
                  className="flex-1"
                >
                  Print Letter
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExpiredPassLetter;
