import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { X, AlertCircle, Calendar, Bell, BellOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/hooks/useNotifications';

interface AlertNotification {
  id: string;
  type: string;
  message: string;
  status: string;
  send_at: string;
  created_at: string;
}

export const AlertNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { supported, permission, requestPermission, sendAlertNotification } = useNotifications();
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAlerts();

      // Check if we should show notification permission prompt
      if (supported && permission === 'default') {
        setShowPermissionPrompt(true);
      }

      // Set up real-time subscription for new alerts
      const channel = supabase
        .channel('alerts-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'alerts',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('New alert received:', payload);
            fetchAlerts();
            
            // Send browser notification
            const newAlert = payload.new as AlertNotification;
            if (newAlert.message) {
              sendAlertNotification(newAlert.message, newAlert.type);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, supported, permission]);

  const fetchAlerts = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'unread'])
      .order('created_at', { ascending: false });

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

  const dismissPermissionPrompt = () => {
    setShowPermissionPrompt(false);
    localStorage.setItem('vbus-notification-prompt-dismissed', 'true');
  };

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      setShowPermissionPrompt(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Notification Permission Prompt */}
      {showPermissionPrompt && !localStorage.getItem('vbus-notification-prompt-dismissed') && (
        <Alert className="glass border-primary/50 bg-primary/10 shadow-lg">
          <Bell className="h-5 w-5 text-primary" />
          <AlertDescription>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="font-semibold mb-1">Enable Browser Notifications</p>
                <p className="text-sm text-muted-foreground mb-3">
                  Get notified about important alerts and announcements even when you're not on this page.
                </p>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={handleEnableNotifications}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Bell className="h-4 w-4 mr-1" />
                    Enable Notifications
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={dismissPermissionPrompt}
                  >
                    <BellOff className="h-4 w-4 mr-1" />
                    Maybe Later
                  </Button>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissPermissionPrompt}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Active Alerts */}
      {alerts.map((alert, index) => (
        <Alert 
          key={alert.id} 
          className="relative glass border-primary/30 bg-primary/5 animate-slide-up shadow-lg"
          style={{ animationDelay: `${index * 0.1}s` }}
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

              {alert.type === 'custom' && (
                <p className="text-xs text-muted-foreground mt-2">
                  Sent by admin • {new Date(alert.created_at).toLocaleDateString()}
                </p>
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
