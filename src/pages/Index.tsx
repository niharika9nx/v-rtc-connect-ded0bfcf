import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bus } from "lucide-react";
import { useState, useEffect } from "react";
import vishnuLogo from '@/assets/vishnu-logo.png';

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

      {/* VISHNU Logo in corner */}
      <div className="absolute top-1 left-1 md:top-2 md:left-2 z-10 animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/40 blur-3xl rounded-full opacity-80 animate-pulse" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-0 bg-accent/30 blur-2xl rounded-full" />
          <img 
            src={vishnuLogo} 
            alt="VISHNU Universal Learning Logo" 
            className="relative h-28 md:h-36 w-auto opacity-95 hover:opacity-100 transition-all hover:scale-105"
            style={{ filter: 'drop-shadow(0 0 20px rgba(var(--primary), 0.6)) drop-shadow(0 0 40px rgba(var(--primary), 0.4))' }}
          />
        </div>
      </div>

      <div className="relative z-10 text-center space-y-6 md:space-y-8 px-4 max-w-4xl mx-auto pb-32 md:pb-24 animate-slide-up">
        {/* Logo/Icon */}
        <div className="flex justify-center mb-4 md:mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
            <div className="relative p-3 md:p-5 rounded-2xl bg-gradient-primary/10 border border-primary/30 backdrop-blur-sm shadow-glow">
              <Bus className="h-12 w-12 md:h-16 md:w-16 text-primary animate-float" />
            </div>
          </div>
        </div>

        <div className="space-y-3 md:space-y-4">
          <h1 className="text-4xl md:text-7xl font-bold font-display text-foreground tracking-tight">
            Welcome to{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              VBus
            </span>
          </h1>
          <p className="text-lg md:text-2xl text-muted-foreground font-medium">
            VES - APSRTC Bus management system
          </p>
          <div className="h-1 w-32 mx-auto bg-gradient-primary rounded-full" />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center pt-2 md:pt-4">
          <Link to="/login">
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 hover:shadow-glow transition-all w-full sm:w-auto text-base md:text-lg px-6 md:px-8 py-5 md:py-6"
            >
              Login
            </Button>
          </Link>
          <Link to="/signup">
            <Button 
              size="lg" 
              variant="outline"
              className="border-primary/30 hover:bg-primary/10 hover:shadow-glow transition-all w-full sm:w-auto text-base md:text-lg px-6 md:px-8 py-5 md:py-6"
            >
              Sign Up as Student
            </Button>
          </Link>
          <Link to="/signup-faculty">
            <Button 
              size="lg" 
              variant="outline"
              className="border-secondary/30 hover:bg-secondary/10 hover:shadow-glow transition-all w-full sm:w-auto text-base md:text-lg px-6 md:px-8 py-5 md:py-6"
            >
              Sign Up as Faculty
            </Button>
          </Link>
        </div>
      </div>

      {/* Copyright section */}
      <div className="absolute bottom-4 left-0 right-0 z-10">
        <div className="text-center text-xs md:text-sm text-muted-foreground/70 px-4 space-y-1">
          <p>© 2025 Shri Vishnu Engineering College For Women (SVECW). All rights reserved.</p>
          <p>Contact: <a href="mailto:vesbusrtc@gmail.com" className="hover:text-primary transition-colors">vesbusrtc@gmail.com</a></p>
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
