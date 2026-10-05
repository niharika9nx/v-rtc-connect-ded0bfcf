import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export const useNotifications = () => {
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const hasNotificationApi = 'Notification' in window;
    const hasServiceWorker = 'serviceWorker' in navigator;
    setSupported(hasNotificationApi || hasServiceWorker);
    if (hasNotificationApi) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        toast({
          title: 'iOS Limitation',
          description: 'On iOS, first tap the Share button, then "Add to Home Screen" to install the app and enable notifications.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Not Supported',
          description: 'Your browser does not support notifications.',
          variant: 'destructive',
        });
      }
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
          description: 'Please enable notifications in your browser site settings.',
          variant: 'destructive',
        });
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [permission, toast]);

  const sendNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    if (permission !== 'granted') {
      return;
    }

    const iconUrl = '/icons/icon-192.png';

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          icon: iconUrl,
          badge: iconUrl,
          tag: 'vbus-notification',
          ...options,
        });
      } else if ('Notification' in window) {
        const notification = new Notification(title, {
          icon: iconUrl,
          badge: iconUrl,
          tag: 'vbus-notification',
          ...options,
        });
        setTimeout(() => notification.close(), 10000);
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }, [permission]);

  const sendAlertNotification = useCallback((message: string, type: string = 'alert') => {
    const titles: Record<string, string> = {
      alert: '🔔 New Alert',
      announcement: '📢 New Announcement',
      pass_renewal_reminder: '🎫 Pass Renewal Reminder',
      custom: '📬 Message from Admin',
    };

    sendNotification(titles[type] || titles.alert, {
      body: message,
      icon: '/icons/icon-192.png',
    });
  }, [sendNotification]);

  return {
    supported,
    permission,
    requestPermission,
    sendNotification,
    sendAlertNotification,
  };
};
