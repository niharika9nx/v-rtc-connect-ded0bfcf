import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  const currentDateTelugu = format(new Date(), 'dd-MM-yyyy');

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
            <Tabs defaultValue="english" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="english">English</TabsTrigger>
                <TabsTrigger value="telugu">తెలుగు</TabsTrigger>
              </TabsList>

              {/* English Version */}
              <TabsContent value="english">
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
                    <p className="font-semibold">Subject: <span className="font-normal">Temporary Pass Issuance Pending - Fee Paid</span></p>
                  </div>

                  {/* Recipient */}
                  <div>
                    <p>To,</p>
                    <p className="font-semibold">The Bus Conductor</p>
                    <p>Bus Number: {profile?.bus_number || 'N/A'}</p>
                    <p>VBus College Transport Service</p>
                  </div>

                  {/* Letter Body */}
                  <div className="space-y-4 text-justify">
                    <p>Dear Sir/Madam,</p>

                    <p>
                      This is to certify that <span className="font-semibold">{profile?.name || 'the bearer'}</span>
                      {profile?.registration_id && <>, Registration ID: <span className="font-semibold">{profile.registration_id}</span></>}
                      {profile?.college && <>, {profile.college}</>}
                      {profile?.department && <>, Department of {profile.department}</>}
                      {profile?.branch && <>, {profile.branch}</>}, is a bonafide {profile?.role || 'student/faculty'} of our institution.
                    </p>

                    <p>
                      We hereby inform you that the above-mentioned {profile?.role || 'individual'} has <span className="font-semibold text-green-600">duly paid the monthly transportation fee</span> for the current month. However, due to administrative processing, their monthly bus pass is yet to be issued.
                    </p>

                    <p className="font-semibold bg-primary/10 p-4 rounded-lg border-l-4 border-primary">
                      We kindly request you to permit {profile?.name || 'the bearer'} to board the bus service during this interim period.
                    </p>

                    <p>
                      The college management assures you that the official monthly bus pass will be issued and provided to the {profile?.role || 'passenger'} within <span className="font-semibold">3-5 business days</span>. The delay is purely administrative and does not reflect any default on the part of the {profile?.role || 'passenger'}.
                    </p>

                    <p>
                      This letter serves as temporary authorization for bus travel until the official pass is issued. We appreciate your understanding and cooperation in this matter.
                    </p>

                    <p>
                      For any verification or queries, please contact the transport administration office.
                    </p>

                    <div className="bg-muted/50 p-4 rounded-lg border">
                      <p className="font-semibold mb-2">Contact for Verification:</p>
                      <p>Palleswari Mam</p>
                      <p className="font-semibold text-primary">Phone: 9000912477</p>
                    </div>

                    <p>Thank you for your cooperation.</p>
                  </div>

                  {/* Footer */}
                  <div className="mt-8 pt-6 border-t space-y-2">
                    <p className="font-semibold">Authorized by:</p>
                    <p className="font-semibold">VBus Transport Administration</p>
                    <p className="text-sm text-muted-foreground">College Transport Management System</p>
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-muted-foreground italic">This is a system-generated letter and requires no signature</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Telugu Version */}
              <TabsContent value="telugu">
                <div className="space-y-6 text-foreground" dir="ltr">
                  {/* Header */}
                  <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold mb-2">వీబస్ కాలేజ్ రవాణా వ్యవస్థ</h1>
                    <p className="text-sm text-muted-foreground">అధికారిక కమ్యూనికేషన్</p>
                  </div>

                  {/* Date */}
                  <div className="text-right">
                    <p className="text-sm">తేదీ: {currentDateTelugu}</p>
                  </div>

                  {/* Subject */}
                  <div>
                    <p className="font-semibold">విషయం: <span className="font-normal">తాత్కాలిక పాస్ జారీ పెండింగ్ - ఫీజు చెల్లించబడింది</span></p>
                  </div>

                  {/* Recipient */}
                  <div>
                    <p>కు,</p>
                    <p className="font-semibold">బస్ కండక్టర్ గారికి</p>
                    <p>బస్ నంబర్: {profile?.bus_number || 'N/A'}</p>
                    <p>వీబస్ కాలేజ్ రవాణా సేవ</p>
                  </div>

                  {/* Letter Body */}
                  <div className="space-y-4 text-justify">
                    <p>గౌరవనీయులు,</p>

                    <p>
                      ఈ పత్రం ద్వారా <span className="font-semibold">{profile?.name || 'ఈ వ్యక్తి'}</span>
                      {profile?.registration_id && <>, రిజిస్ట్రేషన్ ID: <span className="font-semibold">{profile.registration_id}</span></>}
                      {profile?.college && <>, {profile.college}</>}
                      {profile?.department && <>, {profile.department} విభాగం</>}
                      {profile?.branch && <>, {profile.branch}</>}, మా సంస్థకు చెందిన నిజమైన {profile?.role === 'student' ? 'విద్యార్థి' : profile?.role === 'faculty' ? 'అధ్యాపకుడు' : 'విద్యార్థి/అధ్యాపకుడు'} అని ధృవీకరిస్తున్నాము.
                    </p>

                    <p>
                      పైన పేర్కొన్న {profile?.role === 'student' ? 'విద్యార్థి' : profile?.role === 'faculty' ? 'అధ్యాపకుడు' : 'వ్యక్తి'} ప్రస్తుత నెలకు <span className="font-semibold text-green-600">నెలవారీ రవాణా రుసుమును సక్రమంగా చెల్లించినట్లు</span> మేము మీకు తెలియజేస్తున్నాము. అయితే, అడ్మినిస్ట్రేటివ్ ప్రాసెసింగ్ కారణంగా, వారి నెలవారీ బస్ పాస్ ఇంకా జారీ చేయబడలేదు.
                    </p>

                    <p className="font-semibold bg-primary/10 p-4 rounded-lg border-l-4 border-primary">
                      ఈ మధ్యంతర కాలంలో {profile?.name || 'ఈ వ్యక్తిని'} బస్ సేవలో ప్రయాణించడానికి అనుమతించమని మేము మిమ్మల్ని విన్నవించుకుంటున్నాము.
                    </p>

                    <p>
                      అధికారిక నెలవారీ బస్ పాస్ <span className="font-semibold">3-5 పని దినాల్లో</span> జారీ చేసి {profile?.role === 'student' ? 'విద్యార్థికి' : profile?.role === 'faculty' ? 'అధ్యాపకునికి' : 'ప్రయాణికుడికి'} అందజేస్తామని కాలేజ్ మేనేజ్‌మెంట్ మీకు హామీ ఇస్తోంది. ఈ ఆలస్యం పూర్తిగా అడ్మినిస్ట్రేటివ్ కారణాల వల్ల మాత్రమే మరియు {profile?.role === 'student' ? 'విద్యార్థి' : profile?.role === 'faculty' ? 'అధ్యాపకుడు' : 'ప్రయాణికుడు'} వైపు నుండి ఎటువంటి లోపం లేదు.
                    </p>

                    <p>
                      అధికారిక పాస్ జారీ అయ్యే వరకు బస్ ప్రయాణానికి ఈ లేఖ తాత్కాలిక అధికారంగా పనిచేస్తుంది. ఈ విషయంలో మీ అవగాహన మరియు సహకారాన్ని మేము అభినందిస్తున్నాము.
                    </p>

                    <p>
                      ఏవైనా ధృవీకరణ లేదా ప్రశ్నలకు, దయచేసి రవాణా అడ్మినిస్ట్రేషన్ కార్యాలయాన్ని సంప్రదించండి.
                    </p>

                    <div className="bg-muted/50 p-4 rounded-lg border">
                      <p className="font-semibold mb-2">ధృవీకరణ కోసం సంప్రదించండి:</p>
                      <p>పల్లేశ్వరి మేడం</p>
                      <p className="font-semibold text-primary">ఫోన్: 9000912477</p>
                    </div>

                    <p>మీ సహకారానికి ధన్యవాదాలు.</p>
                  </div>

                  {/* Footer */}
                  <div className="mt-8 pt-6 border-t space-y-2">
                    <p className="font-semibold">అధికారం ఇచ్చినవారు:</p>
                    <p className="font-semibold">వీబస్ రవాణా అడ్మినిస్ట్రేషన్</p>
                    <p className="text-sm text-muted-foreground">కాలేజ్ రవాణా నిర్వహణ వ్యవస్థ</p>
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-muted-foreground italic">ఇది సిస్టమ్-జనరేటెడ్ లేఖ మరియు సంతకం అవసరం లేదు</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-6 mt-6 border-t">
                <Button 
                  onClick={() => navigate('/dashboard')}
                  variant="outline"
                  className="flex-1"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.print()}
                  className="flex-1"
                >
                  Print Letter
                </Button>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExpiredPassLetter;
