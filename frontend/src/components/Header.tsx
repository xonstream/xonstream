import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Search, Sun, Moon, User, X, Pencil, LogOut, Film, Tv, Sparkles, Flame, Palette, Check } from 'lucide-react';
import { getTheme, setTheme, THEMES, type ThemeMode, getCurrentUser, signOut, getProfile, saveProfile } from '@/lib/store';
import { quickSearch, type QuickSearchResult } from '@/lib/api';
import { generateVideoUrl } from '@/lib/utils';
import { toast } from 'sonner';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => getTheme());
  const [themeOpen, setThemeOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState(() => getProfile());
  const [suggestions, setSuggestions] = useState<QuickSearchResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const themeDropdownRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();

  // Sync theme
  useEffect(() => {
    setCurrentTheme(getTheme());
  }, []);

  // Click outside to close dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
        setEditProfile(false);
      }
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(e.target as Node)) {
        setThemeOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Quick live search as user types (50ms debounce)
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    const q = searchQuery.trim();
    if (!q) {
      setSuggestions(null);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await quickSearch(q);
        setSuggestions(results);
        setShowDropdown(true);
      } catch (err) {
        console.error('Quick search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 60);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  const handleSelectTheme = (mode: ThemeMode) => {
    setTheme(mode);
    setCurrentTheme(mode);
    setThemeOpen(false);
    const selected = THEMES.find(t => t.id === mode);
    toast.success(`${selected?.icon} ${selected?.name} theme applied!`);
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setShowDropdown(false);
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setMobileSearchOpen(false);
    }
  };

  const handleSelectVideo = (post: any) => {
    setShowDropdown(false);
    setMobileSearchOpen(false);
    const url = generateVideoUrl(post.id, post.title);
    navigate(url, { state: { post } });
  };

  const handleSelectChannel = (chId: string) => {
    setShowDropdown(false);
    setMobileSearchOpen(false);
    navigate(`/channel/${chId}`);
  };

  const handleSelectActor = (actId: string) => {
    setShowDropdown(false);
    setMobileSearchOpen(false);
    navigate(`/actor/${actId}`);
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setSearchQuery('');
    setShowDropdown(false);
    navigate('/');
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

  const hasSuggestions = suggestions && (
    (suggestions.videos && suggestions.videos.length > 0) ||
    (suggestions.channels && suggestions.channels.length > 0) ||
    (suggestions.actors && suggestions.actors.length > 0)
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-background/95 backdrop-blur-xl border-b border-border flex items-center px-3 sm:px-4 gap-3 sm:gap-4 transition-colors">
      
      {/* Mobile expanded search */}
      {mobileSearchOpen && (
        <div className="absolute inset-0 z-[100] bg-background flex flex-col px-3 py-2 animate-in fade-in slide-in-from-top-1 duration-150 sm:hidden">
          <div className="flex items-center gap-2">
            <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center bg-secondary/80 rounded-2xl border border-border overflow-hidden shadow-lg">
              <input 
                type="text" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search videos, channels, actors in milliseconds..." 
                autoFocus
                className="flex-1 bg-transparent px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none" 
              />
              <button type="submit" className="px-3.5 py-2.5 bg-accent text-white transition-colors">
                <Search className="w-4 h-4" />
              </button>
            </form>
            <button 
              onClick={() => setMobileSearchOpen(false)} 
              className="p-2 rounded-xl bg-secondary/60 hover:bg-secondary text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile Instant Dropdown List */}
          {hasSuggestions && (
            <div className="mt-2 bg-[#12131a] border border-white/10 rounded-2xl shadow-2xl overflow-y-auto max-h-[75vh] divide-y divide-white/5">
              {/* Channels & Actors */}
              {(suggestions.channels.length > 0 || suggestions.actors.length > 0) && (
                <div className="p-2 flex flex-wrap gap-1.5">
                  {suggestions.channels.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectChannel(c.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white border border-white/5"
                    >
                      <Tv className="w-3.5 h-3.5 text-blue-400" />
                      <span>{c.name}</span>
                    </button>
                  ))}
                  {suggestions.actors.map(a => (
                    <button
                      key={a.id}
                      onClick={() => handleSelectActor(a.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white border border-white/5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                      <span>{a.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Videos */}
              {suggestions.videos.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleSelectVideo(p)}
                  className="p-2.5 flex items-center gap-3 active:bg-white/5 cursor-pointer"
                >
                  <img 
                    src={p.thumbnail || `https://thumb.tapecontent.net/thumb/${p.id}/thumb.jpg`} 
                    alt={p.title} 
                    className="w-16 h-10 rounded-lg object-cover bg-white/5 flex-shrink-0"
                    onError={e => { e.currentTarget.src = 'https://xonstream.qzz.io/siteicon.ico'; }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white line-clamp-1">{p.title}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{p.channelName || 'Video'}</p>
                  </div>
                </div>
              ))}

              <button
                onClick={() => handleSearchSubmit()}
                className="w-full p-2.5 text-center text-xs font-bold text-accent hover:bg-accent/10 transition-colors"
              >
                View all results for "{searchQuery}" →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Left: Hamburger + Logo */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button 
          onClick={onToggleSidebar} 
          className="p-2 rounded-xl hover:bg-secondary active:scale-95 transition-all text-foreground"
          title="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <button onClick={handleLogoClick} className="flex items-center gap-2 group">
          <img 
            src="/siteicon.ico" 
            alt="XON STREAM Logo" 
            className="w-7 h-7 sm:w-8 sm:h-8 group-hover:scale-105 transition-transform" 
          />
          <span className="text-foreground font-black text-base sm:text-lg tracking-tight">
            XON <span className="text-accent">STREAM</span>
          </span>
        </button>
      </div>

      {/* Center - Super Fast Instant Search (Desktop) */}
      <div className="flex-1 max-w-xl mx-auto hidden sm:block relative" ref={searchContainerRef}>
        <form onSubmit={handleSearchSubmit} className="flex items-center">
          <div className="flex flex-1 items-center bg-secondary/60 hover:bg-secondary focus-within:bg-secondary rounded-2xl border border-border focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 overflow-hidden shadow-inner transition-all">
            <input 
              ref={searchInputRef}
              type="text" 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => { if (suggestions) setShowDropdown(true); }}
              placeholder="Instant Search videos, creators, actors..." 
              className="flex-1 bg-transparent px-4 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none" 
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => { setSearchQuery(''); setShowDropdown(false); }}
                className="p-1.5 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button 
              type="submit" 
              className="px-4 py-2.5 bg-accent hover:bg-accent/90 text-white font-semibold transition-all border-l border-white/10 flex items-center justify-center"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Live Search Floating Dropdown */}
        {showDropdown && hasSuggestions && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-[#12131a]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 divide-y divide-white/5">
            
            {/* Quick Channel & Actor Matches */}
            {(suggestions.channels.length > 0 || suggestions.actors.length > 0) && (
              <div className="p-2.5 bg-white/[0.02] flex flex-wrap gap-2">
                {suggestions.channels.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectChannel(c.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 text-xs font-semibold transition-all"
                  >
                    <Tv className="w-3.5 h-3.5" />
                    <span>{c.name}</span>
                  </button>
                ))}
                {suggestions.actors.map(a => (
                  <button
                    key={a.id}
                    onClick={() => handleSelectActor(a.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/20 text-xs font-semibold transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{a.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Video List */}
            <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
              {suggestions.videos.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleSelectVideo(p)}
                  className="p-2.5 flex items-center gap-3 hover:bg-white/[0.05] cursor-pointer transition-colors group"
                >
                  <img 
                    src={p.thumbnail || `https://thumb.tapecontent.net/thumb/${p.id}/thumb.jpg`} 
                    alt={p.title} 
                    className="w-16 h-10 rounded-lg object-cover bg-white/5 flex-shrink-0 group-hover:scale-105 transition-transform"
                    onError={e => { e.currentTarget.src = 'https://xonstream.qzz.io/siteicon.ico'; }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white group-hover:text-accent transition-colors line-clamp-1">
                      {p.title}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                      {p.channelName || 'Featured Video'}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer view all */}
            <button
              onClick={() => handleSearchSubmit()}
              className="w-full p-2.5 text-center text-xs font-bold text-accent hover:bg-accent/10 transition-colors block"
            >
              See all results for "{searchQuery}" →
            </button>
          </div>
        )}
      </div>

      {/* Right Tools */}
      <div className="flex items-center gap-1.5 ml-auto">
        {/* Mobile search trigger */}
        {!mobileSearchOpen && (
          <button 
            onClick={() => setMobileSearchOpen(true)} 
            className="p-2 rounded-xl hover:bg-secondary active:scale-95 transition-all text-foreground sm:hidden"
            title="Search"
          >
            <Search className="w-5 h-5" />
          </button>
        )}

        {/* Multi-Theme Selector Popover */}
        <div className="relative" ref={themeDropdownRef}>
          <button 
            onClick={() => setThemeOpen(!themeOpen)} 
            className="p-2 rounded-xl hover:bg-secondary active:scale-95 transition-all text-foreground flex items-center gap-1.5"
            title="Choose Theme Style"
          >
            <Palette className="w-5 h-5 text-accent" />
          </button>

          {themeOpen && (
            <div className="absolute right-0 top-11 w-64 bg-card/95 backdrop-blur-2xl border border-border rounded-2xl shadow-2xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2.5 py-1.5 border-b border-border/50 flex items-center justify-between">
                <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">Appearance</span>
                <span className="text-[10px] text-muted-foreground font-mono">7 Themes</span>
              </div>
              <div className="space-y-1 pt-1 max-h-72 overflow-y-auto">
                {THEMES.map(t => {
                  const isActive = currentTheme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTheme(t.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive 
                          ? 'bg-accent/15 text-foreground ring-1 ring-accent' 
                          : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-4 h-4 rounded-full border border-white/20 shadow-inner flex-shrink-0" 
                          style={{ background: t.accentPreview }} 
                        />
                        <span className="flex items-center gap-1.5">
                          <span>{t.icon}</span>
                          <span>{t.name}</span>
                        </span>
                      </div>
                      {isActive && <Check className="w-3.5 h-3.5 text-accent" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => {
              if (user) {
                setProfileOpen(!profileOpen);
              } else {
                toast.info('Sign up / login will be available soon.');
              }
            }}
            className="p-1 rounded-full hover:ring-2 hover:ring-accent/40 active:scale-95 transition-all"
          >
            {profileIcon ? (
              <img src={profileIcon} alt="" className="w-8 h-8 rounded-full object-cover shadow" />
            ) : user ? (
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shadow-lg shadow-accent/25">
                <span className="text-white text-xs font-bold">{avatarLetter}</span>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                <User className="w-4 h-4" />
              </div>
            )}
          </button>

          {profileOpen && user && (
            <div className="absolute right-0 top-11 w-72 bg-[#12131a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {!editProfile ? (
                <>
                  <div className="px-4 py-3 border-b border-white/10">
                    <p className="text-sm font-semibold text-white">{profileName}</p>
                    <p className="text-xs text-gray-400">{user.email}</p>
                  </div>
                  <button 
                    onClick={() => setEditProfile(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-xs text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <Pencil className="w-4 h-4 text-accent" /> Edit Profile
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors border-t border-white/10"
                  >
                    <LogOut className="w-4 h-4" /> Log Out
                  </button>
                </>
              ) : (
                <div className="p-4 space-y-3">
                  <p className="text-xs font-bold text-white uppercase tracking-wider">Edit Profile</p>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Display Name</label>
                    <input 
                      value={profileForm.name} 
                      onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                      placeholder={user.username} 
                      className="w-full px-3 py-2 bg-black/40 rounded-xl text-xs text-white outline-none border border-white/10 focus:border-accent" 
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Profile Icon URL</label>
                    <input 
                      value={profileForm.icon} 
                      onChange={e => setProfileForm({ ...profileForm, icon: e.target.value })}
                      placeholder="https://..." 
                      className="w-full px-3 py-2 bg-black/40 rounded-xl text-xs text-white outline-none border border-white/10 focus:border-accent" 
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={handleSaveProfile}
                      className="flex-1 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl text-xs font-semibold shadow-lg shadow-accent/25 transition-all"
                    >
                      Save
                    </button>
                    <button 
                      onClick={() => setEditProfile(false)}
                      className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-semibold transition-all"
                    >
                      Cancel
                    </button>
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
