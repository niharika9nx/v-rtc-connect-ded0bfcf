import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Bus, UserPlus, Users } from 'lucide-react';

interface BusRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const COLLEGE_OPTIONS: Record<string, { branches: string[]; years: string[]; sections: string[] }> = {
  'SVECW': {
    branches: ['CSE', 'AIDS', 'AIML', 'CSE-CS', 'IT', 'ECE', 'EEE', 'CE', 'ME'],
    years: ['1', '2', '3', '4'],
    sections: ['A', 'B', 'C']
  },
  'Smt. B seetha Polytechnic': {
    branches: ['DCME', 'DECE', 'DEEE', 'DME', 'DCHE'],
    years: ['1', '2', '3'],
    sections: ['A', 'B']
  },
  'VDC': {
    branches: ['BPharm', 'MPharm'],
    years: ['1', '2', '3', '4'],
    sections: ['A']
  },
  'Shri vishnu college of pharmacy': {
    branches: ['BPharm', 'MPharm', 'PharmD'],
    years: ['1', '2', '3', '4', '5', '6'],
    sections: ['A']
  },
  'B V Raju college': {
    branches: ['BA', 'BCom', 'BSc', 'BBA', 'BCA'],
    years: ['1', '2', '3'],
    sections: ['A', 'B']
  }
};

export const BusRequestDialog = ({ open, onOpenChange, onSuccess }: BusRequestDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<'select' | 'existing' | 'new'>('select');
  const [submitting, setSubmitting] = useState(false);
  const [buses, setBuses] = useState<any[]>([]);

  // Existing user form
  const [busNumber, setBusNumber] = useState('');

  // New user form
  const [fromMonth, setFromMonth] = useState('');
  const [toMonth, setToMonth] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [college, setCollege] = useState('');
  const [studyYear, setStudyYear] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (open) {
      fetchBuses();
      setStep('select');
      resetForm();
    }
  }, [open]);

  const fetchBuses = async () => {
    const { data } = await supabase
      .from('bus_details')
      .select('bus_number, route')
      .order('bus_number');
    setBuses(data || []);
  };

  const resetForm = () => {
    setBusNumber('');
    setFromMonth('');
    setToMonth('');
    setYear(new Date().getFullYear().toString());
    setCollege('');
    setStudyYear('');
    setComment('');
  };

  const handleSubmitExisting = async () => {
    if (!busNumber.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter or select a bus number',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('bus_requests').insert({
      user_id: user?.id,
      request_type: 'existing',
      requested_bus_number: busNumber.trim(),
    });

    setSubmitting(false);
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit request',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Request Submitted',
        description: 'Your bus request has been sent to admin.',
      });
      onOpenChange(false);
      onSuccess?.();
    }
  };

  const handleSubmitNew = async () => {
    if (!fromMonth || !toMonth || !year || !college || !studyYear) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('bus_requests').insert({
      user_id: user?.id,
      request_type: 'new',
      from_month: fromMonth,
      to_month: toMonth,
      year: parseInt(year),
      college,
      study_year: studyYear,
      comment: comment.trim() || null,
    });

    setSubmitting(false);
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit request',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Request Submitted',
        description: 'Your bus request has been sent to admin.',
      });
      onOpenChange(false);
      onSuccess?.();
    }
  };

  const collegeData = college ? COLLEGE_OPTIONS[college] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md glass border-border/50">
        <DialogHeader>
          <DialogTitle className="text-foreground font-display flex items-center gap-2">
            <Bus className="h-5 w-5 text-primary" />
            Request for Bus
          </DialogTitle>
        </DialogHeader>

        {step === 'select' && (
          <div className="grid grid-cols-1 gap-4 py-4">
            <Card 
              className="glass border-border/50 hover:shadow-glow transition-all cursor-pointer group"
              onClick={() => setStep('existing')}
            >
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Existing User</h3>
                  <p className="text-sm text-muted-foreground">I already know which bus I need</p>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="glass border-border/50 hover:shadow-glow transition-all cursor-pointer group"
              onClick={() => setStep('new')}
            >
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-3 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors">
                  <UserPlus className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">New User</h3>
                  <p className="text-sm text-muted-foreground">I need help finding the right bus</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'existing' && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="busNumber">Bus Number</Label>
              <Select value={busNumber} onValueChange={setBusNumber}>
                <SelectTrigger className="bg-muted/30 border-border/50">
                  <SelectValue placeholder="Select bus number" />
                </SelectTrigger>
                <SelectContent>
                  {buses.map((bus) => (
                    <SelectItem key={bus.bus_number} value={bus.bus_number}>
                      Bus {bus.bus_number} {bus.route ? `- ${bus.route}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setStep('select')} className="flex-1">
                Back
              </Button>
              <Button 
                onClick={handleSubmitExisting} 
                disabled={submitting}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </div>
        )}

        {step === 'new' && (
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>For how many months you want to use the bus?</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Select value={fromMonth} onValueChange={setFromMonth}>
                    <SelectTrigger className="bg-muted/30 border-border/50">
                      <SelectValue placeholder="From month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month) => (
                        <SelectItem key={month} value={month}>{month}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Select value={toMonth} onValueChange={setToMonth}>
                    <SelectTrigger className="bg-muted/30 border-border/50">
                      <SelectValue placeholder="To month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month) => (
                        <SelectItem key={month} value={month}>{month}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g., 2025"
                className="bg-muted/30 border-border/50"
              />
            </div>

            <div className="space-y-2">
              <Label>College</Label>
              <Select value={college} onValueChange={(v) => { setCollege(v); setStudyYear(''); }}>
                <SelectTrigger className="bg-muted/30 border-border/50">
                  <SelectValue placeholder="Select college" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(COLLEGE_OPTIONS).map((col) => (
                    <SelectItem key={col} value={col}>{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {collegeData && (
              <div className="space-y-2">
                <Label>Study Year</Label>
                <Select value={studyYear} onValueChange={setStudyYear}>
                  <SelectTrigger className="bg-muted/30 border-border/50">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {collegeData.years.map((yr) => (
                      <SelectItem key={yr} value={yr}>Year {yr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="comment">Comment (Optional)</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Any additional information about your bus requirements..."
                className="bg-muted/30 border-border/50"
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setStep('select')} className="flex-1">
                Back
              </Button>
              <Button 
                onClick={handleSubmitNew} 
                disabled={submitting}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
