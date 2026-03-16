import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface LogoutConfirmDialogProps {
  onConfirm: () => void;
  triggerClassName?: string;
  triggerVariant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary' | 'link';
  triggerSize?: 'default' | 'sm' | 'lg' | 'icon';
}

const LogoutConfirmDialog = ({ onConfirm, triggerClassName, triggerVariant = 'outline', triggerSize = 'sm' }: LogoutConfirmDialogProps) => {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} className={triggerClassName}>
          Logout
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="glass border-border/50">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">Are you sure you want to logout?</AlertDialogTitle>
          <AlertDialogDescription>
            You will be signed out of your account and redirected to the login page.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Logout</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default LogoutConfirmDialog;
