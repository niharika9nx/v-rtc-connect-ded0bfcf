import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export const SessionTimeoutDialog = () => {
  const { showWarning, extendSession } = useSessionTimeout();

  return (
    <AlertDialog open={showWarning}>
      <AlertDialogContent className="glass border-border/50">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">Session Expiring Soon</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Your session will expire in 1 minute due to inactivity. Click below to continue your session.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction 
            onClick={extendSession}
            className="bg-primary hover:bg-primary/90 hover:shadow-glow"
          >
            Continue Session
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
