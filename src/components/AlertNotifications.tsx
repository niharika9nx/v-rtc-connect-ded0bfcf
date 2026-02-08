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
  const [passVerified, setPassVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) {
      // Check pass verification status first
      checkPassVerification();
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

  const checkPassVerification = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('passes')
      .select('verified')
      .eq('user_id', user.id)
      .maybeSingle();

    setPassVerified(data?.verified !== false);
  };

  const fetchAlerts = async () => {
    if (!user) return;

    // Recheck pass verification status on every fetch
    await checkPassVerification();

    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'unread'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching alerts:', error);
    } else {
      // Filter out pass-related alerts if pass is fake (not verified)
      const filteredAlerts = (data || []).filter(alert => {
        // If pass is fake, hide pass renewal reminders
        if (passVerified === false && alert.type === 'pass_renewal_reminder') {
          return false;
        }
        return true;
      });
      setAlerts(filteredAlerts);
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
    if (!user) return;

    try {
      // Soft delete - set deleted_at timestamp instead of hard delete
      // Add user_id filter to guarantee we only ever attempt to dismiss the current user's alerts.
      const { data, error } = await supabase
        .from('alerts')
        .update({ status: 'dismissed', deleted_at: new Date().toISOString() })
        .eq('id', alertId)
        .eq('user_id', user.id)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Unable to dismiss this alert (not found or not permitted).');
      }

      // Immediately remove from local state for instant feedback
      setAlerts(prev => prev.filter(a => a.id !== alertId));

      toast({
        title: 'Alert dismissed',
        description: 'The notification has been removed.',
      });
    } catch (error: any) {
      console.error('Error dismissing alert:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to dismiss alert. Please try again.',
        variant: 'destructive'
      });
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
    <div className="space-y-2 sm:space-y-3">
      {/* Notification Permission Prompt */}
      {showPermissionPrompt && !localStorage.getItem('vbus-notification-prompt-dismissed') && (
        <Alert className="glass border-primary/50 bg-primary/10 shadow-lg p-3 sm:p-4">
          <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          <AlertDescription>
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold mb-1 text-sm sm:text-base">Enable Browser Notifications</p>
                <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">
                  Get notified about important alerts even when you're not on this page.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    size="sm" 
                    onClick={handleEnableNotifications}
                    className="bg-primary hover:bg-primary/90 text-xs sm:text-sm"
                  >
                    <Bell className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    Enable
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={dismissPermissionPrompt}
                    className="text-xs sm:text-sm"
                  >
                    <BellOff className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    Later
                  </Button>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissPermissionPrompt}
                className="h-6 w-6 p-0 shrink-0"
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
          className="relative glass border-primary/30 bg-primary/5 animate-slide-up shadow-lg p-3 sm:p-4"
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <div className="flex items-start gap-2 sm:gap-3">
            {alert.type === 'pass_renewal_reminder' ? (
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary mt-0.5 shrink-0" />
            )}
            
            <div className="flex-1 min-w-0">
              <AlertDescription className="text-foreground font-medium mb-2 sm:mb-3 text-sm sm:text-base break-words">
                {alert.message}
              </AlertDescription>
              
              {alert.type === 'pass_renewal_reminder' && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => handleResponse(alert.id, 'yes')}
                    className="bg-primary hover:bg-primary/90 text-xs sm:text-sm"
                  >
                    Yes, I got it
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleResponse(alert.id, 'no')}
                    className="border-primary/30 text-xs sm:text-sm"
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
              className="h-6 w-6 p-0 hover:bg-primary/10 shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      ))}
    </div>
  );
};
