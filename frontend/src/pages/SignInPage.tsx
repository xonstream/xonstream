import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signIn } from '@/lib/store';
import { Eye, EyeOff, User, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function SignInPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = signIn(username, password, rememberMe);
    if (result.success) {
      toast.success('Welcome back!');
      navigate('/');
    } else {
      setError(result.error || 'Invalid credentials');
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
        <h1 className="text-2xl font-bold text-foreground text-center mb-2">Welcome Back 👋</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">Sign in to your account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" value={username} onChange={e => { setUsername(e.target.value); setError(''); }}
              placeholder="Username" className="w-full pl-10 pr-4 py-3 bg-secondary rounded-pill text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring text-sm" />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type={showPw ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Password" className="w-full pl-10 pr-10 py-3 bg-secondary rounded-pill text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring text-sm" />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
              className="rounded accent-primary" />
            Remember Me
          </label>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <button type="submit" className="w-full py-3 bg-primary text-primary-foreground rounded-pill font-semibold text-sm hover:opacity-90 transition-opacity">
            Sign In
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">OR</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <p className="text-sm text-muted-foreground text-center">
          Don't have an account? <Link to="/signup" className="text-accent font-semibold hover:underline">Sign Up</Link>
        </p>
      </div>
    </div>
  );
}
