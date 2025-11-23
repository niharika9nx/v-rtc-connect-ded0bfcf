import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export const useNotifications = () => {
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    if ('Notification' in window) {
      setSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!supported) {
      toast({
        title: 'Not Supported',
        description: 'Browser notifications are not supported on this device.',
        variant: 'destructive',
      });
      return false;
    }

    if (permission === 'granted') {
      return true;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        toast({
          title: 'Notifications Enabled',
          description: 'You will now receive notifications for important alerts.',
        });
        return true;
      } else if (result === 'denied') {
        toast({
          title: 'Notifications Blocked',
          description: 'Please enable notifications in your browser settings.',
          variant: 'destructive',
        });
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

  const sendNotification = (title: string, options?: NotificationOptions) => {
    if (!supported) {
      return;
    }

    if (permission !== 'granted') {
      console.log('Notification permission not granted');
      return;
    }

    // Don't send notification if page is visible
    if (document.visibilityState === 'visible') {
      return;
    }

    try {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'vbus-notification',
        ...options,
      });

      // Close notification after 10 seconds
      setTimeout(() => notification.close(), 10000);

      // Handle notification click
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  const sendAlertNotification = (message: string, type: string = 'alert') => {
    const titles: Record<string, string> = {
      alert: '🔔 New Alert',
      announcement: '📢 New Announcement',
      pass_renewal_reminder: '🎫 Pass Renewal Reminder',
      custom: '📬 Message from Admin',
    };

    sendNotification(titles[type] || titles.alert, {
      body: message,
      icon: '/favicon.ico',
    });
  };

  return {
    supported,
    permission,
    requestPermission,
    sendNotification,
    sendAlertNotification,
  };
};
