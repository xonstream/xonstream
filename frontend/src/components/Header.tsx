import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Search, Sun, Moon, User, X, Pencil, LogOut } from 'lucide-react';
import { getTheme, setTheme, getCurrentUser, signOut, getProfile, saveProfile } from '@/lib/store';
import { toast } from 'sonner';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDark, setIsDark] = useState(() => {
    const theme = getTheme();
    console.log('Header mounted, theme from localStorage:', theme);
    return theme === 'dark';
  });
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState(() => getProfile());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync theme state on mount and when it changes externally
  useEffect(() => {
    const currentTheme = getTheme();
    console.log('useEffect syncing theme:', currentTheme);
    setIsDark(currentTheme === 'dark');
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
        setEditProfile(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleThemeToggle = () => {
    const newTheme = isDark ? 'light' : 'dark';
    console.log('Theme toggle: current=', isDark, 'new=', newTheme);
    setTheme(newTheme);
    setIsDark(newTheme === 'dark');
    toast.success(`${newTheme === 'dark' ? '🌙 Dark' : '☀️ Light'} mode enabled`);
  };

  // Sync search input with URL query parameter when navigating or URL changes and input is not focused
  useEffect(() => {
    const activeEl = document.activeElement;
    const isInputFocused = activeEl && (activeEl.id === 'desktop-search-input' || activeEl.id === 'mobile-search-input');
    
    // If the input is currently focused, do not sync (prevents cursor jumping/input clearing while typing)
    if (isInputFocused) {
      return;
    }
    
    const pathParts = location.pathname.split('/').filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];
    const isOnSearchPage = lastPart === 'search';
    
    if (isOnSearchPage) {
      const params = new URLSearchParams(location.search);
      const queryParam = params.get('q') || '';
      if (searchQuery !== queryParam) {
        setSearchQuery(queryParam);
      }
    } else {
      if (searchQuery !== '') {
        setSearchQuery('');
      }
    }
  }, [location.pathname, location.search]);

  // DISABLED: Live search causes infinite loop
  // Search only works on Enter key or search button click

  const handleLogoClick = () => {
    // Clear search query
    setSearchQuery('');
    // Scroll to the top of the page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('=== HANDLESEARCH CALLED ===', { searchQuery });
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (searchQuery.trim()) {
      const searchUrl = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
      console.log('Navigating to:', searchUrl);
      navigate(searchUrl);
      setMobileSearchOpen(false);
    } else {
      console.log('Search query is empty, not navigating');
    }
  };

  const handleSaveProfile = () => {
    saveProfile(profileForm);
    setEditProfile(false);
  };

  const handleLogout = () => {
    signOut();
    setProfileOpen(false);
    navigate('/');
    window.location.reload();
  };

  const profileIcon = profileForm.icon || null;
  const profileName = profileForm.name || user?.username || '';
  const avatarLetter = (profileName || 'U')[0].toUpperCase();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-12 sm:h-14 bg-background/95 backdrop-blur-sm border-b border-border flex items-center px-3 sm:px-4 gap-3 sm:gap-4">
      {/* Mobile expanded search */}
      {mobileSearchOpen && (
        <div className="absolute inset-0 z-[100] h-12 bg-background flex items-center px-3 gap-2 animate-fade-in sm:hidden">
          <form onSubmit={handleSearch} className="flex-1 flex items-center bg-secondary rounded-[24px] border border-border overflow-hidden">
            <input type="text" id="mobile-search-input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search..." autoFocus
              className="flex-1 bg-transparent px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
            <button type="submit" className="px-4 py-2 bg-tertiary hover:bg-border transition-colors border-l border-border">
              <Search className="w-4 h-4 text-foreground" />
            </button>
          </form>
          <button onClick={() => setMobileSearchOpen(false)} className="p-2 rounded-full hover:bg-secondary transition-colors z-[101]">
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>
      )}

      {/* Left */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button onClick={onToggleSidebar} className="p-2 rounded-full hover:bg-secondary transition-colors">
          <Menu className="w-5 h-5 text-foreground" />
        </button>
        <Link to="/" onClick={handleLogoClick} className="flex items-center gap-1.5">
          <img src="/siteicon.ico" alt="XON STREAM Logo" className="w-6 h-6 sm:w-7 sm:h-7" />
          <span className="text-foreground font-bold text-base sm:text-lg hidden sm:inline">XON STREAM</span>
          <span className="text-foreground font-bold text-base sm:hidden">XON STREAM</span>
        </Link>
      </div>

      {/* Center - Search (desktop) */}
      <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-auto hidden sm:flex items-center">
        <div className="flex flex-1 items-center bg-secondary rounded-[24px] border border-border overflow-hidden">
          <input type="text" id="desktop-search-input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search..." className="flex-1 bg-transparent px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
          <button type="submit" className="px-4 py-2 bg-tertiary hover:bg-border transition-colors border-l border-border">
            <Search className="w-4 h-4 text-foreground" />
          </button>
        </div>
      </form>

      {/* Right */}
      <div className="flex items-center gap-1 ml-auto">
        {/* Mobile search icon - hidden when search is open */}
        {!mobileSearchOpen && (
          <button onClick={() => setMobileSearchOpen(true)} className="p-2 rounded-full hover:bg-secondary transition-colors sm:hidden">
            <Search className="w-5 h-5 text-foreground" />
          </button>
        )}
        <button onClick={handleThemeToggle} className="p-2 rounded-full hover:bg-secondary transition-colors">
          {isDark ? <Moon className="w-5 h-5 text-foreground" /> : <Sun className="w-5 h-5 text-foreground" />}
        </button>

        {/* Profile icon + dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button onClick={() => {
            if (user) {
              setProfileOpen(!profileOpen);
            } else {
              toast.info('Sign up/login is currently under work, it will be available soon.');
            }
          }}
            className="p-1 rounded-full hover:bg-secondary transition-colors">
            {profileIcon ? (
              <img src={profileIcon} alt="" className="w-7 h-7 rounded-full object-cover" />
            ) : user ? (
              <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center">
                <span className="text-accent-foreground text-xs font-bold">{avatarLetter}</span>
              </div>
            ) : (
              <User className="w-5 h-5 text-foreground" />
            )}
          </button>

          {profileOpen && user && (
            <div className="absolute right-0 top-10 w-72 bg-card border border-border rounded-[12px] shadow-xl z-50 overflow-hidden animate-fade-in">
              {!editProfile ? (
                <>
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-semibold text-foreground">{profileName}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <button onClick={() => setEditProfile(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-secondary transition-colors">
                    <Pencil className="w-4 h-4 text-muted-foreground" /> Edit Profile
                  </button>
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-secondary transition-colors border-t border-border">
                    <LogOut className="w-4 h-4" /> Log Out
                  </button>
                </>
              ) : (
                <div className="p-4 space-y-3">
                  <p className="text-sm font-semibold text-foreground">Edit Profile</p>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Display Name</label>
                    <input value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                      placeholder={user.username} className="w-full px-3 py-2 bg-secondary rounded-[12px] text-sm text-foreground outline-none border border-border focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Profile Icon URL</label>
                    <input value={profileForm.icon} onChange={e => setProfileForm({ ...profileForm, icon: e.target.value })}
                      placeholder="https://..." className="w-full px-3 py-2 bg-secondary rounded-[12px] text-sm text-foreground outline-none border border-border focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Or Upload Image</label>
                    <label className="flex items-center justify-center gap-2 w-full px-3 py-2.5 bg-secondary hover:bg-tertiary rounded-[12px] text-sm text-foreground cursor-pointer transition-colors border border-border">
                      <Pencil className="w-3.5 h-3.5" /> Choose Image
                      <input type="file" accept="image/*" className="hidden" onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setProfileForm({ ...profileForm, icon: reader.result as string });
                        reader.readAsDataURL(file);
                      }} />
                    </label>
                  </div>
                  {profileForm.icon && (
                    <div className="flex justify-center">
                      <img src={profileForm.icon} alt="Preview" className="w-16 h-16 rounded-full object-cover border-2 border-border" />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={handleSaveProfile}
                      className="flex-1 py-2 bg-primary text-primary-foreground rounded-[12px] text-sm font-medium hover:opacity-90">Save</button>
                    <button onClick={() => setEditProfile(false)}
                      className="flex-1 py-2 bg-secondary text-secondary-foreground rounded-[12px] text-sm font-medium hover:bg-tertiary">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
