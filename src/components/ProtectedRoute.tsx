import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    const checkRoles = async () => {
      if (!user) {
        setCheckingRole(false);
        return;
      }

      if (!allowedRoles || allowedRoles.length === 0) {
        setHasAccess(true);
        setCheckingRole(false);
        return;
      }

      // Check each allowed role using the secure has_role function
      let hasAnyRole = false;
      for (const role of allowedRoles) {
        const { data } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: role as any,
        });
        if (data) {
          hasAnyRole = true;
          break;
        }
      }

      setHasAccess(hasAnyRole);
      setCheckingRole(false);
    };

    checkRoles();
  }, [user, allowedRoles]);

  if (loading || checkingRole) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && hasAccess === false) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
