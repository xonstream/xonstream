import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAdminSession, getCurrentUser } from '@/lib/store';
import { adminLogin } from '@/lib/api';
import { Lock, Eye, EyeOff } from 'lucide-react';

export default function AdminGate() {
  const navigate = useNavigate();

  // ALL hooks must be at the top — no hooks after early returns
  const [passphrase, setPassphrase] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(() => getCurrentUser());

  // Don't auto-redirect — always show the password form
  // This allows re-authentication even if already logged in

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Call backend login API
      const result = await adminLogin('admin', passphrase);
      
      console.log('[ADMIN GATE] Login result:', result);
      
      if (result.success) {
        // Store admin session in localStorage
        setAdminSession();
        
        // Store token for API authentication
        if (result.token) {
          localStorage.setItem('admin_token', result.token);
          console.log('[ADMIN GATE] Token stored in localStorage');
        }
        
        // Verify it was actually stored
        const storedUser = getCurrentUser();
        
        if (storedUser?.isAdmin) {
          // Update local state
          setUser(storedUser);
          // Small delay to ensure localStorage is flushed
          setTimeout(() => {
            window.location.href = '/meow/panel';
          }, 100);
        } else {
          console.error('Failed to store admin user in localStorage');
          setError('Failed to initialize admin session');
        }
      } else {
        console.error('[ADMIN GATE] Login failed:', result);
        setError(result.message || 'Wrong password. Access denied.');
        setPassphrase('');
      }
    } catch (err) {
      console.error('[ADMIN GATE] Login error:', err);
      setError('Login failed. Please try again.');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Admin Access</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter the passphrase to continue</p>
        </div>

        {/* If already logged in, show a quick link to panel */}
        {user?.isAdmin && (
          <div className="mb-4 p-3 bg-accent/10 border border-accent/20 rounded-[12px] text-center">
            <p className="text-sm text-accent mb-2">✓ You're already logged in</p>
            <button 
              onClick={() => navigate('/meow/panel')}
              className="text-xs text-accent hover:underline"
            >
              Go to Admin Panel →
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-[16px] p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">Passphrase</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                placeholder="Enter passphrase"
                autoFocus
                className="w-full px-4 py-2.5 pr-10 bg-secondary rounded-[12px] text-foreground text-sm outline-none focus:ring-2 focus:ring-accent border border-border"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-[8px] px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !passphrase}
            className="w-full py-2.5 bg-accent text-white rounded-[12px] text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Checking…' : 'Enter Admin Panel'}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground/40 mt-6">
          This page is private. Do not share this URL.
        </p>
      </div>
    </div>
  );
}
