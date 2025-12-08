import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bus, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import vishnuLogo from '@/assets/vishnu-logo.png';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  speedX: number;
  speedY: number;
}

interface FloatingOrb {
  id: number;
  size: number;
  x: number;
  y: number;
  duration: number;
  delay: number;
}

const Index = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [particles, setParticles] = useState<Particle[]>([]);
  const [floatingOrbs] = useState<FloatingOrb[]>(() => 
    Array.from({ length: 6 }, (_, i) => ({
      id: i,
      size: Math.random() * 300 + 100,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: Math.random() * 10 + 15,
      delay: Math.random() * 5,
    }))
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
      
      // Create trailing particle
      if (Math.random() > 0.7) {
        const newParticle: Particle = {
          id: Date.now() + Math.random(),
          x: e.clientX,
          y: e.clientY,
          size: Math.random() * 6 + 2,
          opacity: Math.random() * 0.5 + 0.3,
          speedX: (Math.random() - 0.5) * 2,
          speedY: (Math.random() - 0.5) * 2,
        };
        setParticles(prev => [...prev.slice(-20), newParticle]);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Clean up old particles
  useEffect(() => {
    const interval = setInterval(() => {
      setParticles(prev => prev.filter((_, i) => i > prev.length - 15));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background overflow-hidden">
      {/* Animated background orbs */}
      {floatingOrbs.map((orb) => (
        <div
          key={orb.id}
          className="absolute rounded-full bg-primary/10 animate-glow-pulse"
          style={{
            width: orb.size,
            height: orb.size,
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            animationDuration: `${orb.duration}s`,
            animationDelay: `${orb.delay}s`,
            filter: 'blur(60px)',
          }}
        />
      ))}

      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Mouse follow gradient */}
      <div 
        className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
        style={{
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, hsl(var(--primary) / 0.06), transparent 40%)`,
        }}
      />

      {/* Floating particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full bg-primary pointer-events-none z-20"
          style={{
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            opacity: particle.opacity,
            transform: 'translate(-50%, -50%)',
            transition: 'opacity 0.5s ease-out',
            boxShadow: `0 0 ${particle.size * 2}px hsl(var(--primary) / 0.5)`,
          }}
        />
      ))}

      {/* Orbiting elements */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-[300px] h-[300px] md:w-[400px] md:h-[400px]">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute inset-0 rounded-full border border-primary/10"
              style={{
                transform: `scale(${1 + i * 0.4})`,
              }}
            />
          ))}
          <div 
            className="absolute w-3 h-3 bg-primary rounded-full animate-orbit"
            style={{ 
              top: '50%', 
              left: '50%',
              boxShadow: '0 0 20px hsl(var(--primary))',
            }}
          />
          <div 
            className="absolute w-2 h-2 bg-accent rounded-full"
            style={{ 
              top: '50%', 
              left: '50%',
              animation: 'orbit 15s linear infinite reverse',
              boxShadow: '0 0 15px hsl(var(--accent))',
            }}
          />
        </div>
      </div>

      {/* VISHNU Logo in corner */}
      <div className="absolute top-1 left-1 md:top-2 md:left-2 z-10 animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/30 blur-3xl rounded-full opacity-60 animate-glow-pulse" />
          <img 
            src={vishnuLogo} 
            alt="VISHNU Universal Learning Logo" 
            className="relative h-28 md:h-36 w-auto opacity-95 hover:opacity-100 transition-all duration-300 hover:scale-105"
            style={{
              filter: 'drop-shadow(0 0 20px hsl(var(--primary) / 0.5))'
            }}
          />
        </div>
      </div>

      <div className="relative z-10 text-center space-y-6 md:space-y-8 px-4 max-w-4xl mx-auto pb-32 md:pb-24">
        {/* Logo/Icon with enhanced glow */}
        <div className="mb-4 md:mb-6 items-center justify-center flex flex-row animate-float">
          <div className="relative group">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-glow-pulse" />
            <div className="absolute -inset-4 bg-gradient-primary opacity-20 blur-2xl rounded-full group-hover:opacity-30 transition-opacity" />
            <div className="relative p-4 md:p-6 bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/30 backdrop-blur-sm shadow-glow rounded-2xl group-hover:border-primary/50 transition-all duration-300">
              <Bus className="h-12 w-12 md:h-14 md:w-14 text-primary" />
              <Sparkles className="absolute -top-2 -right-2 h-5 w-5 text-accent animate-scale-pulse" />
            </div>
          </div>
        </div>

        <div className="space-y-4 md:space-y-5">
          <h1 className="text-4xl font-bold font-display text-foreground tracking-tight md:text-6xl animate-slide-up">
            Welcome to{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent animate-gradient-shift">
              V-RTC CONNECT
            </span>
          </h1>
          <p className="text-lg md:text-2xl text-muted-foreground font-medium animate-slide-up" style={{ animationDelay: '0.1s' }}>
            VES - APSRTC Bus management system
          </p>
          <div className="h-1 w-32 mx-auto bg-gradient-primary rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-foreground/30 animate-shimmer" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center pt-4 md:pt-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <Link to="/login">
            <Button 
              size="lg" 
              className="relative overflow-hidden bg-gradient-primary hover:shadow-glow transition-all duration-300 w-full sm:w-auto text-base md:text-lg px-6 md:px-8 py-5 md:py-6 group"
            >
              <span className="relative z-10">Login</span>
              <div className="absolute inset-0 bg-foreground/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
            </Button>
          </Link>
          <Link to="/signup">
            <Button 
              size="lg" 
              variant="outline" 
              className="border-primary/40 bg-primary/5 hover:bg-primary/15 hover:border-primary/60 hover:shadow-glow transition-all duration-300 w-full sm:w-auto text-base md:text-lg px-6 md:px-8 py-5 md:py-6"
            >
              Sign Up as Student
            </Button>
          </Link>
          <Link to="/signup-faculty">
            <Button 
              size="lg" 
              variant="outline" 
              className="border-accent/40 bg-accent/5 hover:bg-accent/15 hover:border-accent/60 transition-all duration-300 w-full sm:w-auto text-base md:text-lg px-6 md:px-8 py-5 md:py-6"
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
    </div>
  );
};

export default Index;
