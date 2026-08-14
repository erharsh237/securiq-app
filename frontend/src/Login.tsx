import { useRef, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { ThemeContext } from './App';
import useLoginThreeScene from './hooks/useLoginThreeScene';
import './Login.css';

// 1. Strict Zod Schema
const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().trim()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")
});

export default function Login() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const { theme } = useContext(ThemeContext);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [honeypot, setHoneypot] = useState(''); // Anti-bot field
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  useLoginThreeScene(canvasRef, theme);

  useEffect(() => {
    // Reveal animation
    gsap.fromTo(containerRef.current, 
      { y: 50, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 1.2, ease: 'power3.out' }
    );
    gsap.to(canvasRef.current, { opacity: 1, duration: 2, ease: "power2.inOut" });
  }, []);

  // Handle Lockout Timer
  useEffect(() => {
    let interval;
    if (isLocked && lockoutTimer > 0) {
      interval = setInterval(() => setLockoutTimer(prev => prev - 1), 1000);
    } else if (isLocked && lockoutTimer === 0) {
      setIsLocked(false);
      setFailedAttempts(0);
      setErrorMsg('');
    }
    return () => clearInterval(interval);
  }, [isLocked, lockoutTimer]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLocked) return;

    setErrorMsg('');

    // 2. Anti-Bot Honeypot check
    if (honeypot.length > 0) {
      // Silently reject without giving bot feedback
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        setEmail('');
        setPassword('');
      }, 2000);
      return;
    }

    // 3. Zod Payload Validation
    try {
      loginSchema.parse({ email, password });
    } catch (err) {
      if (err instanceof z.ZodError) {
        setErrorMsg(err.errors[0].message);
        return;
      }
    }

    setIsLoading(true);

    // Mock authentication flow
    setTimeout(() => {
      // New strict mock password
      if (email === 'admin@securiq.com' && password === 'Password@123') {
        window.location.href = 'https://app.securiq.co';
      } else {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        
        // 4. Brute-force Lockout Logic
        if (newAttempts >= 3) {
          setIsLocked(true);
          setLockoutTimer(30); // Lock for 30s
          setErrorMsg('Too many failed attempts. Account temporarily locked.');
        } else {
          setErrorMsg('Invalid credentials. Please try again.');
        }
        setIsLoading(false);
      }
    }, 1500);
  };

  return (
    <div className="login-wrapper">
      <canvas ref={canvasRef} className="login-canvas" style={{ opacity: 0 }} />
      
      <div className="login-overlay">
        <a href="https://securiq.co" className="login-back">← Back to Securiq</a>
        
        <div className="login-container" ref={containerRef}>
          <div className="login-header">
            <svg width="0" height="0" style={{ position: 'absolute' }}>
              <filter id="logo-filter-dark-login" colorInterpolationFilters="sRGB">
                <feColorMatrix type="matrix" values="
                  1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  1 1 1 0 0
                " />
              </filter>
              <filter id="logo-filter-light-login" colorInterpolationFilters="sRGB">
                <feColorMatrix type="matrix" values="
                  1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  1 1 1 0 0
                " result="nobg" />
                <feComponentTransfer in="nobg" result="inverted">
                  <feFuncR type="linear" slope="-1" intercept="1" />
                  <feFuncG type="linear" slope="-1" intercept="1" />
                  <feFuncB type="linear" slope="-1" intercept="1" />
                </feComponentTransfer>
                <feColorMatrix type="hueRotate" values="180" in="inverted" />
              </filter>
            </svg>
            <img 
              src="/logo.png" 
              alt="SECURIQ" 
              height="52" 
              style={{ 
                margin: '0 auto 1.5rem', 
                display: 'block',
                filter: theme === 'light' ? 'url(#logo-filter-light-login)' : 'url(#logo-filter-dark-login)' 
              }} 
            />
            <h2>Access your dashboard</h2>
            <p>Sign in to view your security posture</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            {/* Honeypot field - visually hidden, inaccessible to screen readers */}
            <input 
              type="text" 
              name="company_website" 
              className="honeypot" 
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex="-1" 
              aria-hidden="true" 
              autoComplete="off"
            />

            <div className="input-group">
              <label htmlFor="email">Work Email</label>
              <input 
                type="email" 
                id="email" 
                placeholder="engineer@company.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || isLocked}
                required
              />
            </div>
            
            <div className="input-group relative-group">
              <label htmlFor="password">Password</label>
              <div className="password-wrapper">
                <input 
                  type={showPassword ? "text" : "password"} 
                  id="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading || isLocked}
                  required
                />
                <button 
                  type="button" 
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={isLoading || isLocked}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-actions">
              <label className="remember-me">
                <input type="checkbox" disabled={isLoading || isLocked} /> Remember me
              </label>
              <a href="#" className="forgot-password">Forgot password?</a>
            </div>

            {errorMsg && (
              <div className="error-alert" role="alert" aria-live="assertive">
                {errorMsg}
                {isLocked && <span> ({lockoutTimer}s)</span>}
              </div>
            )}

            <button 
              type="submit" 
              className="login-btn" 
              disabled={isLoading || isLocked} 
              style={{ opacity: (isLoading || isLocked) ? 0.7 : 1 }}
            >
              {isLocked ? `Locked (${lockoutTimer}s)` : isLoading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div className="login-footer">
            Don't have an account? <a href="/#waitlist">Request access</a>
          </div>
        </div>
      </div>
    </div>
  );
}
