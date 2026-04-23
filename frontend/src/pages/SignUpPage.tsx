import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signUp } from '@/lib/store';
import { Eye, EyeOff, User, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';

export default function SignUpPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const passwordStrength = () => {
    if (password.length === 0) return 0;
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 10) s++;
    if (/[A-Z]/.test(password) && /[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  };

  const strength = passwordStrength();
  const strengthColor = ['bg-destructive', 'bg-destructive', 'bg-server-orange', 'bg-server-green', 'bg-server-green'][strength];
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPw) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    const result = signUp(username, email, password);
    if (result.success) {
      toast.success('Account created!');
      navigate('/');
    } else {
      setError(result.error || 'Sign up failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border p-8 animate-fade-in shadow-modal">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
            <span className="text-primary-foreground text-xl font-bold">▶</span>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground text-center mb-2">Create Account ✨</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">Join VidStream today</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" value={username} onChange={e => { setUsername(e.target.value); setError(''); }}
              placeholder="Username" required className="w-full pl-10 pr-4 py-3 bg-secondary rounded-pill text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring text-sm" />
          </div>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
              placeholder="Email" required className="w-full pl-10 pr-4 py-3 bg-secondary rounded-pill text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring text-sm" />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type={showPw ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Password" required className="w-full pl-10 pr-10 py-3 bg-secondary rounded-pill text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring text-sm" />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {password && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? strengthColor : 'bg-border'}`} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{strengthLabel}</p>
            </div>
          )}
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="password" value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setError(''); }}
              placeholder="Confirm Password" required className="w-full pl-10 pr-10 py-3 bg-secondary rounded-pill text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring text-sm" />
            {confirmPw && password === confirmPw && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-server-green">✅</span>
            )}
          </div>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <button type="submit" className="w-full py-3 bg-primary text-primary-foreground rounded-pill font-semibold text-sm hover:opacity-90 transition-opacity">
            Sign Up
          </button>
        </form>

        <p className="text-sm text-muted-foreground text-center mt-6">
          Already have an account? <Link to="/signin" className="text-accent font-semibold hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
