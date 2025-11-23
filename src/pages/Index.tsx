import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bus } from "lucide-react";
import { useState, useEffect } from "react";
import apsrtcLogo from '@/assets/apsrtc-logo.png';

interface Ripple {
  id: number;
  x: number;
  y: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const Index = () => {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [rippleId, setRippleId] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [particleId, setParticleId] = useState(0);

  const createRipple = (e: React.MouseEvent | React.TouchEvent) => {
    let x: number, y: number;
    
    if ('touches' in e) {
      // Touch event
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else {
      // Mouse event
      x = e.clientX;
      y = e.clientY;
    }

    const newRipple: Ripple = {
      id: rippleId,
      x,
      y,
    };

    setRipples((prev) => [...prev, newRipple]);
    setRippleId((prev) => prev + 1);

    // Remove ripple after animation
    setTimeout(() => {
      setRipples((prev) => prev.filter((ripple) => ripple.id !== newRipple.id));
    }, 1000);
  };

  const createParticle = (x: number, y: number) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2 + 1;
    const newParticle: Particle = {
      id: particleId,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    };

    setParticles((prev) => [...prev, newParticle]);
    setParticleId((prev) => prev + 1);

    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== newParticle.id));
    }, 800);
  };

  useEffect(() => {
    let lastTime = Date.now();
    
    const handleMove = (x: number, y: number) => {
      const now = Date.now();
      if (now - lastTime > 30) {
        createParticle(x, y);
        lastTime = now;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleTouch = (e: TouchEvent) => {
      const syntheticEvent = {
        touches: e.touches,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as any;
      createRipple(syntheticEvent);
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchstart', handleTouch, { passive: true });
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchstart', handleTouch);
    };
  }, [rippleId, particleId]);

  return (
    <div 
      className="relative flex min-h-screen items-center justify-center bg-background bg-mesh overflow-hidden"
      onClick={createRipple}
      onTouchStart={createRipple}
    >
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-primary opacity-5 animate-pulse" style={{ animationDuration: '4s' }} />
      
      {/* Smoke trail effects */}
      {particles.map((particle) => (
        <div
          key={`particle-${particle.id}`}
          className="absolute pointer-events-none animate-smoke"
          style={{
            left: particle.x,
            top: particle.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div 
            className="w-8 h-8 rounded-full bg-gradient-radial from-primary/30 via-primary/15 to-transparent"
            style={{ filter: 'blur(8px)' }}
          />
        </div>
      ))}
      
      {/* Touch ripple effects */}
      {ripples.map((ripple) => (
        <div
          key={`ripple-${ripple.id}`}
          className="absolute pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="absolute w-4 h-4 rounded-full bg-primary/30 animate-ping" />
          <div className="absolute w-8 h-8 rounded-full bg-gradient-primary opacity-30 animate-[scale-out_1s_ease-out]" style={{
            animation: 'ripple-out 1s ease-out forwards',
          }} />
        </div>
      ))}

      {/* APSRTC Logo in corner */}
      <div className="absolute top-4 left-4 z-10 animate-fade-in">
        <img 
          src={apsrtcLogo} 
          alt="APSRTC Logo" 
          className="h-16 w-auto opacity-80 hover:opacity-100 transition-opacity"
        />
      </div>

      <div className="relative z-10 text-center space-y-8 px-4 max-w-4xl mx-auto animate-slide-up">
        {/* Logo/Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
            <div className="relative p-6 rounded-2xl bg-gradient-primary/10 border border-primary/30 backdrop-blur-sm shadow-glow">
              <Bus className="h-20 w-20 text-primary animate-float" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-5xl md:text-7xl font-bold font-display text-foreground tracking-tight">
            Welcome to{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              VBus
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground font-medium">
            College Bus Transportation Management System
          </p>
          <div className="h-1 w-32 mx-auto bg-gradient-primary rounded-full" />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link to="/login">
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 hover:shadow-glow transition-all w-full sm:w-auto text-lg px-8 py-6"
            >
              Login
            </Button>
          </Link>
          <Link to="/signup">
            <Button 
              size="lg" 
              variant="outline"
              className="border-primary/30 hover:bg-primary/10 hover:shadow-glow transition-all w-full sm:w-auto text-lg px-8 py-6"
            >
              Sign Up as Student
            </Button>
          </Link>
          <Link to="/signup-faculty">
            <Button 
              size="lg" 
              variant="outline"
              className="border-secondary/30 hover:bg-secondary/10 hover:shadow-glow transition-all w-full sm:w-auto text-lg px-8 py-6"
            >
              Sign Up as Faculty
            </Button>
          </Link>
        </div>

        <div className="pt-8 text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <p>A SVECW product</p>
        </div>
      </div>

      <style>{`
        @keyframes ripple-out {
          0% {
            width: 2rem;
            height: 2rem;
            opacity: 0.6;
          }
          100% {
            width: 20rem;
            height: 20rem;
            opacity: 0;
          }
        }
        
        @keyframes smoke {
          0% {
            opacity: 0.8;
            transform: translate(-50%, -50%) scale(0.5);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -80%) scale(2.5);
          }
        }
        
        .animate-smoke {
          animation: smoke 0.8s ease-out forwards;
        }
        
        .bg-gradient-radial {
          background: radial-gradient(circle, var(--tw-gradient-stops));
        }
      `}</style>
    </div>
  );
};

export default Index;
