import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

// Timeout duration in milliseconds (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;
// Warning before timeout (1 minute)
const WARNING_TIME = 1 * 60 * 1000;

export const useSessionTimeout = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [showWarning, setShowWarning] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
    setShowWarning(false);
  }, []);

  const handleLogout = useCallback(async () => {
    clearTimers();
    toast({
      title: 'Session Expired',
      description: 'You have been logged out due to inactivity.',
      variant: 'destructive',
    });
    await signOut();
  }, [clearTimers, signOut, toast]);

  const resetTimer = useCallback(() => {
    clearTimers();

    if (!user) return;

    // Set warning timer
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      toast({
        title: 'Session Expiring Soon',
        description: 'Your session will expire in 1 minute due to inactivity.',
        variant: 'default',
      });
    }, SESSION_TIMEOUT - WARNING_TIME);

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, SESSION_TIMEOUT);
  }, [user, clearTimers, handleLogout, toast]);

  const extendSession = useCallback(() => {
    toast({
      title: 'Session Extended',
      description: 'Your session has been extended.',
    });
    resetTimer();
  }, [resetTimer, toast]);

  useEffect(() => {
    if (!user) {
      clearTimers();
      return;
    }

    // Events that indicate user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    // Throttle reset to avoid excessive timer resets
    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledReset = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          resetTimer();
          throttleTimeout = null;
        }, 1000); // Reset timer at most once per second
      }
    };

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, throttledReset);
    });

    // Initialize timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, throttledReset);
      });
      clearTimers();
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
    };
  }, [user, resetTimer, clearTimers]);

  return { showWarning, extendSession, timeRemaining: WARNING_TIME };
};
