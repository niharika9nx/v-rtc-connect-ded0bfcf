import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Bus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface FloatingBus {
  id: number;
  x: number;
  y: number;
  speed: number;
  delay: number;
}

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [floatingBuses, setFloatingBuses] = useState<FloatingBus[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Create floating buses animation
  useEffect(() => {
    const buses: FloatingBus[] = Array.from({ length: 5 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      speed: 20 + Math.random() * 30,
      delay: Math.random() * 5,
    }));
    setFloatingBuses(buses);
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const checkRoleAndRedirect = async () => {
        const { data } = await supabase.rpc('has_role', { 
          _user_id: user.id, 
          _role: 'admin' 
        });
        
        if (data) {
          navigate('/admin', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      };
      
      checkRoleAndRedirect();
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: 'Login Failed',
        description: error.message,
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    if (data.user) {
      // Check role from user_roles table (secure)
      const { data: roleData } = await supabase
        .rpc('has_role', { _user_id: data.user.id, _role: 'admin' });

      if (roleData) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }

    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      setResetLoading(false);
      return;
    }

    toast({
      title: 'Check Your Email',
      description: 'A password reset link has been sent to your email address.',
    });

    setShowResetDialog(false);
    setResetEmail('');
    setResetLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-mesh p-4 overflow-hidden relative">
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-primary opacity-5 animate-pulse" style={{ animationDuration: '4s' }} />
      
      {/* Animated road lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="road-line" style={{ left: '20%', animationDelay: '0s' }} />
        <div className="road-line" style={{ left: '40%', animationDelay: '0.5s' }} />
        <div className="road-line" style={{ left: '60%', animationDelay: '1s' }} />
        <div className="road-line" style={{ left: '80%', animationDelay: '1.5s' }} />
      </div>

      {/* Floating buses */}
      {floatingBuses.map((bus) => (
        <div
          key={bus.id}
          className="floating-bus"
          style={{
            left: `${bus.x}%`,
            top: `${bus.y}%`,
            animationDuration: `${bus.speed}s`,
            animationDelay: `${bus.delay}s`,
          }}
        >
          <Bus className="h-6 w-6 text-primary/30" />
        </div>
      ))}

      <Card className="w-full max-w-md glass border-border/50 shadow-lg hover:shadow-glow transition-all animate-slide-up relative z-10">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10 border border-primary/30">
              <Bus className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-display text-foreground">Login to VBus</CardTitle>
          <CardDescription className="text-muted-foreground">Enter your credentials to access your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-muted/30 border-border/50 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-muted/30 border-border/50 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90 hover:shadow-glow" 
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
              <DialogTrigger asChild>
                <button className="text-sm text-primary hover:text-primary/90 underline">
                  Forgot Password?
                </button>
              </DialogTrigger>
              <DialogContent className="glass border-border/50">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Reset Password</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Enter your email address and we'll send you a link to reset your password.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleForgotPassword} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="resetEmail" className="text-foreground">Email</Label>
                    <Input
                      id="resetEmail"
                      type="email"
                      placeholder="you@example.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      className="bg-muted/30 border-border/50 text-foreground"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90" 
                    disabled={resetLoading}
                  >
                    {resetLoading ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="mt-4 text-center text-sm">
            <p className="text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/signup" className="text-primary underline hover:text-primary/90 font-semibold">
                Sign up as Student
              </Link>{' '}
              or{' '}
              <Link to="/signup-faculty" className="text-primary underline hover:text-primary/90 font-semibold">
                Faculty
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>

      <style>{`
        @keyframes road-scroll {
          0% {
            transform: translateY(-100%);
          }
          100% {
            transform: translateY(100vh);
          }
        }

        @keyframes float-across {
          0% {
            transform: translate(0, 0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.3;
          }
          90% {
            opacity: 0.3;
          }
          100% {
            transform: translate(50vw, -20vh) rotate(10deg);
            opacity: 0;
          }
        }

        .road-line {
          position: absolute;
          width: 4px;
          height: 40px;
          background: linear-gradient(180deg, transparent, hsl(var(--primary) / 0.3), transparent);
          animation: road-scroll 3s linear infinite;
        }

        .floating-bus {
          position: absolute;
          animation: float-across 25s linear infinite;
          pointer-events: none;
          filter: drop-shadow(0 0 10px hsl(var(--primary) / 0.5));
        }
      `}</style>
    </div>
  );
};

export default Login;
