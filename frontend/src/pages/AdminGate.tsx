import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAdminSession, getCurrentUser } from '@/lib/store';
import { adminLogin } from '@/lib/api';
import { 
  ShieldCheck, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Home, 
  Sparkles, 
  KeyRound, 
  AlertCircle,
  Play
} from 'lucide-react';
import Loader from '@/components/Loader';

export default function AdminGate() {
  const navigate = useNavigate();

  const [passphrase, setPassphrase] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [user, setUser] = useState(() => getCurrentUser());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase || loading) return;

    setLoading(true);
    setError('');
    
    try {
      const result = await adminLogin('admin', passphrase);
      
      if (result.success) {
        setAdminSession(result.token);
        setUser(getCurrentUser());
        navigate('/meow/panel', { replace: true });
      } else {
        setError(result.message || 'Incorrect passphrase. Access denied.');
        setPassphrase('');
        setShake(true);
        setTimeout(() => setShake(false), 600);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Unable to reach server. Please check your connection.');
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07080d] flex items-center justify-center p-4 relative overflow-hidden selection:bg-accent selection:text-white">
      
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-accent/20 via-purple-600/15 to-transparent rounded-full blur-3xl pointer-events-none animate-pulse duration-1000" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-gradient-to-br from-indigo-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      
      {/* Decorative Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      <div className="w-full max-w-md relative z-10 space-y-6">
        
        {/* Brand Top Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="relative group">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-accent/30 via-purple-600/20 to-white/5 border border-white/15 backdrop-blur-2xl flex items-center justify-center shadow-2xl shadow-purple-950/60 group-hover:scale-105 group-hover:border-accent/40 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center text-white shadow-lg shadow-accent/40">
                <Lock className="w-6 h-6" />
              </div>
            </div>
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-accent"></span>
            </span>
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-semibold text-accent uppercase tracking-widest mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>XON Stream Gatekeeper</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Admin Access</h1>
            <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
              Please enter your authorized administrator passphrase to unlock the management console.
            </p>
          </div>
        </div>

        {/* Existing Session Alert */}
        {user?.isAdmin && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2 backdrop-blur-xl animate-in fade-in duration-300">
            <p className="text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Active administrator session detected
            </p>
            <button 
              onClick={() => navigate('/meow/panel')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold transition-all"
            >
              <span>Jump to Admin Panel</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main Authentication Glass Card */}
        <div className={`bg-[#12131a]/85 border border-white/10 rounded-3xl p-7 shadow-2xl shadow-black/80 backdrop-blur-2xl transition-transform duration-300 ${shake ? 'animate-bounce' : ''}`}>
          <form onSubmit={handleSubmit} className="space-y-5">
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-accent" /> Passphrase
                </span>
                <span className="text-[10px] text-gray-500 font-normal">Encrypted Auth</span>
              </label>

              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={passphrase}
                  onChange={e => setPassphrase(e.target.value)}
                  placeholder="Enter secret passphrase..."
                  autoFocus
                  className="w-full px-4 py-3.5 pr-12 bg-black/50 border border-white/10 rounded-2xl text-white text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/15 transition-all placeholder:text-gray-600 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 active:scale-95"
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !passphrase}
              className="w-full py-3.5 px-5 bg-gradient-to-r from-accent via-accent to-purple-600 hover:opacity-95 active:scale-[0.98] text-white font-bold rounded-2xl text-xs tracking-wider uppercase shadow-xl shadow-accent/25 transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader size="small" />
                  <span>Verifying Credentials...</span>
                </div>
              ) : (
                <>
                  <span>Unlock Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

          </form>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between text-xs text-gray-500 px-2">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors py-1 px-2 rounded-lg hover:bg-white/5"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Return to Site</span>
          </button>

          <span className="text-[11px] font-mono text-gray-600">
            v3.0.0 • Strict Mode
          </span>
        </div>

      </div>
    </div>
  );
}
