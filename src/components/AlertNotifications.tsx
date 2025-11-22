import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { X, AlertCircle, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AlertNotification {
  id: string;
  type: string;
  message: string;
  status: string;
  send_at: string;
}

export const AlertNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAlerts();
    }
  }, [user]);

  const fetchAlerts = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('send_at', { ascending: false });

    if (error) {
      console.error('Error fetching alerts:', error);
    } else {
      setAlerts(data || []);
    }
    setLoading(false);
  };

  const handleResponse = async (alertId: string, response: 'yes' | 'no') => {
    try {
      const { error } = await supabase.functions.invoke('respond-to-alert', {
        body: { alertId, response }
      });

      if (error) throw error;

      toast({
        title: response === 'yes' ? 'Great!' : 'Reminder set',
        description: response === 'yes' 
          ? 'Please upload your new pass in the E-Pass section.' 
          : 'We will remind you again tomorrow.',
      });

      // Refresh alerts
      fetchAlerts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const dismissAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ status: 'dismissed' })
        .eq('id', alertId);

      if (error) throw error;
      fetchAlerts();
    } catch (error: any) {
      console.error('Error dismissing alert:', error);
    }
  };

  if (loading || alerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-4">
      {alerts.map((alert) => (
        <Alert 
          key={alert.id} 
          className="relative glass border-primary/30 bg-primary/5 animate-slide-up"
        >
          <div className="flex items-start gap-3">
            {alert.type === 'pass_renewal_reminder' ? (
              <Calendar className="h-5 w-5 text-primary mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
            )}
            
            <div className="flex-1">
              <AlertDescription className="text-foreground font-medium mb-3">
                {alert.message}
              </AlertDescription>
              
              {alert.type === 'pass_renewal_reminder' && (
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => handleResponse(alert.id, 'yes')}
                    className="bg-primary hover:bg-primary/90"
                  >
                    Yes, I got it
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleResponse(alert.id, 'no')}
                    className="border-primary/30"
                  >
                    Not yet
                  </Button>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => dismissAlert(alert.id)}
              className="h-6 w-6 p-0 hover:bg-primary/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      ))}
    </div>
  );
};
