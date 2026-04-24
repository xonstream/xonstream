import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, signOut, getSettings, saveSettings } from '@/lib/store';
import { API_BASE, fetchAdminPosts, fetchChannels, fetchActors, saveChannel, saveActor, deleteChannel, deleteActor, fetchAdminPlayerSettings, updatePlayerSettings, fetchCategories, saveCategory, deleteCategory, syncPosts, deleteAllPosts, adminLogout } from '@/lib/api';
import Loader from '@/components/Loader';

import type { Channel, Actor, Category, Post, VideoSourceInput } from '@/lib/types';
import { BarChart3, Film, Tv, Users, Tag, Settings, LogOut, Plus, Pencil, Trash2, Menu, X, RefreshCw, Search, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

type AdminTab = 'dashboard' | 'posts' | 'channels' | 'actors' | 'categories' | 'settings' | 'player-settings';

// Cloud/Rocket Loading Animation Component
function RocketLoader({ text = 'Loading' }: { text?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative w-[300px] h-[200px]">
        {/* Clouds */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="cloud cloud1 absolute w-[100px] h-[60px] bg-white/25 rounded-full top-[15%] animate-moveClouds1" />
          <div className="cloud cloud2 absolute w-[150px] h-[80px] bg-white/25 rounded-full top-[35%] animate-moveClouds2" />
          <div className="cloud cloud3 absolute w-[80px] h-[50px] bg-white/25 rounded-full top-[20%] animate-moveClouds3" />
          <div className="cloud cloud4 absolute w-[100px] h-[80px] bg-white/25 rounded-full top-[70%] animate-moveClouds4" />
          <div className="cloud cloud5 absolute w-[170px] h-[50px] bg-white/25 rounded-full top-[80%] animate-moveClouds5" />
        </div>
        
        {/* Rocket */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-speeder">
          <div className="relative">
            {/* Rocket body */}
            <div className="w-[35px] h-[5px] bg-[#f51313] rounded-[2px_10px_1px_0] absolute -top-[19px] left-[60px]" />
            
            {/* Base flame */}
            <div className="relative">
              <div className="w-0 h-0 border-t-[6px] border-t-transparent border-r-[100px] border-r-[#f3cfcf] border-b-[6px] border-b-transparent" />
              <div className="absolute -right-[110px] -top-[16px] w-[22px] h-[22px] bg-[#f3cfcf] rounded-full" />
              <div className="absolute -right-[98px] -top-[16px] w-0 h-0 border-t-0 border-t-transparent border-r-[55px] border-r-[#f3cfcf] border-b-[16px] border-b-transparent" />
              
              {/* Rocket face */}
              <div className="absolute -right-[125px] -top-[15px] w-[20px] h-[12px] bg-[#f3cfcf] rounded-[20px_20px_0_0] rotate-[-40deg]">
                <div className="absolute right-[4px] top-[7px] w-[12px] h-[12px] bg-[#f51313] rotate-40 rounded-[0_0_2px_2px]" />
              </div>
            </div>
            
            {/* Fazer lines */}
            <div className="absolute -top-[19px] left-[60px]">
              <div className="w-[30px] h-[1px] bg-white animate-fazer1" />
              <div className="w-[30px] h-[1px] bg-white top-[3px] absolute animate-fazer2" />
              <div className="w-[30px] h-[1px] bg-white top-[1px] absolute animate-fazer3" />
              <div className="w-[30px] h-[1px] bg-white top-[4px] absolute animate-fazer4" />
            </div>
          </div>
        </div>
        
        {/* Long fazers */}
        <div className="absolute inset-0">
          <div className="absolute top-[20%] h-[2px] w-[20%] bg-white animate-lf1" />
          <div className="absolute top-[40%] h-[2px] w-[20%] bg-white animate-lf2" />
          <div className="absolute top-[60%] h-[2px] w-[20%] bg-white animate-lf3" />
          <div className="absolute top-[80%] h-[2px] w-[20%] bg-white animate-lf4" />
        </div>
        
        {/* Loading text */}
        <div className="absolute bottom-0 left-0 right-0 text-center">
          <p className="text-lg font-bold text-foreground">{text}...</p>
        </div>
      </div>
    </div>
  );
}

// Done Animation Component
function DoneAnimation({ onComplete }: { onComplete: () => void }) {
  React.useEffect(() => {
    const timer = setTimeout(onComplete, 1500);
    return () => clearTimeout(timer);
  }, [onComplete]);
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-bounce">✓</div>
        <p className="text-2xl font-bold text-foreground">Done!</p>
      </div>
    </div>
  );
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-[12px] w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-secondary"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div className="mb-3">
      <label className="text-sm font-medium text-foreground block mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-4 py-2 bg-secondary rounded-[24px] text-foreground text-sm outline-none focus:ring-2 focus:ring-ring border border-border" />
    </div>
  );
}

// Textarea field that auto-resizes based on content
function TextAreaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="mb-3">
      <label className="text-sm font-medium text-foreground block mb-1">{label}</label>
      <textarea 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        placeholder={placeholder}
        rows={2}
        className="w-full px-4 py-2 bg-secondary rounded-[12px] text-foreground text-sm outline-none focus:ring-2 focus:ring-ring border border-border resize-none overflow-hidden"
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = 'auto';
          target.style.height = target.scrollHeight + 'px';
        }}
      />
    </div>
  );
}

const LS_KEYS = { posts: 'vidstream_posts', channels: 'vidstream_channels', actors: 'vidstream_actors', categories: 'vidstream_categories' };

// Player domain cache - fetched from backend
let cachedPlayerDomain: string | null = null;

// Helper to build full thumbnail URL from path
function buildThumbnailUrl(thumbnailPath: string): string {
  if (!thumbnailPath) return '';
  if (thumbnailPath.startsWith('http://') || thumbnailPath.startsWith('https://')) {
    return thumbnailPath;
  }
  // Use cached domain or fallback (will be updated from backend config)
  const playerDomain = cachedPlayerDomain || 'xonstream.seeks.cloud';
  const domain = `https://${playerDomain}`;
  const path = thumbnailPath.startsWith('/') ? thumbnailPath : `/${thumbnailPath}`;
  return `${domain}${path}`;
}

// Fetch player domain from backend config
async function fetchPlayerDomain(): Promise<string> {
  if (cachedPlayerDomain) return cachedPlayerDomain;
  
  try {
    const res = await fetch('/api/public/config');
    const json = await res.json();
    if (json.success && json.data.playerDomain) {
      cachedPlayerDomain = json.data.playerDomain;
      return cachedPlayerDomain;
    }
  } catch (error) {
    // Silently use fallback in production
  }
  
  return 'xonstream.seeks.cloud';
}

// Initialize player domain on app load
fetchPlayerDomain();

function loadData<T>(key: string, fallback: T[]): T[] {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : fallback;
}
function saveData<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ── Search+Select dropdown ──
function SearchSelect({ label, value, onChange, options, placeholder }: { 
  label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // When query is empty (just focused), show ALL options; when user types, filter
  const filtered = query ? options.filter(o => o.toLowerCase().includes(query.toLowerCase())) : options;
  return (
    <div className="mb-3 relative">
      <label className="text-sm font-medium text-foreground block mb-1">{label}</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={open ? query : value}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => { setQuery(value); setOpen(true); }}
          onBlur={() => setTimeout(() => { setOpen(false); setQuery(''); }, 200)}
          placeholder={placeholder || `Search ${label.toLowerCase()}...`}
          className="w-full pl-9 pr-4 py-2 bg-secondary rounded-[24px] text-foreground text-sm outline-none focus:ring-2 focus:ring-ring border border-border" />
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-card border border-border rounded-[12px] shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-4 py-2 text-sm text-muted-foreground italic">No results found</div>
          ) : filtered.slice(0, 20).map(o => (
            <button key={o} type="button" onMouseDown={() => { onChange(o); setQuery(''); setOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors first:rounded-t-[12px] last:rounded-b-[12px]">
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Simple thumbnail component that handles errors properly
function Thumbnail({ post }: { post: Post }) {
  const [error, setError] = useState(false);
  
  // Build full URL from thumbnail path
  const thumbnailSrc = post.thumbnail && post.thumbnail.trim() !== '' && post.thumbnail !== 'null' && post.thumbnail !== 'undefined' 
    ? buildThumbnailUrl(post.thumbnail)
    : null;
  
  const src = thumbnailSrc;

  // Debug: Log when thumbnail fails to load (development only)
  const handleError = () => {
    if (import.meta.env.DEV) {
      console.warn(`Thumbnail failed to load for post "${post.title}":`, {
        originalPath: post.thumbnail,
        builtUrl: thumbnailSrc,
        src
      });
    }
    setError(true);
  };

  // If no valid source, show fallback immediately
  if (!src || error) {
    return (
      <div className="w-20 h-12 rounded-[8px] bg-gradient-to-br from-accent/30 to-secondary flex items-center justify-center">
        <span className="text-lg font-bold text-foreground/50 uppercase">{(post.title || '?')[0]}</span>
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={post.title} 
      className="w-20 h-12 rounded-[8px] object-cover bg-secondary block"
      loading="lazy"
      onError={handleError}
    />
  );
}

// Mobile thumbnail component
function MobileThumbnail({ post }: { post: Post }) {
  const [error, setError] = useState(false);
  
  // Build full URL from thumbnail path
  const thumbnailSrc = post.thumbnail && post.thumbnail.trim() !== '' && post.thumbnail !== 'null' && post.thumbnail !== 'undefined' 
    ? buildThumbnailUrl(post.thumbnail)
    : null;
  
  const src = thumbnailSrc;

  // Debug: Log when mobile thumbnail fails to load (development only)
  const handleError = () => {
    if (import.meta.env.DEV) {
      console.warn(`Mobile thumbnail failed to load for post "${post.title}":`, {
        originalPath: post.thumbnail,
        builtUrl: thumbnailSrc,
        src
      });
    }
    setError(true);
  };

  if (!src || error) {
    return (
      <div className="w-16 h-10 rounded-[8px] bg-gradient-to-br from-accent/30 to-secondary flex-shrink-0 flex items-center justify-center">
        <span className="text-sm font-bold text-foreground/50 uppercase">{(post.title || '?')[0]}</span>
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={post.title} 
      className="w-16 h-10 rounded-[8px] object-cover bg-secondary block flex-shrink-0"
      loading="lazy"
      onError={handleError}
    />
  );
}
function ActorMultiSelect({ selected, onChange, options }: {
  selected: string[]; onChange: (v: string[]) => void; options: string[];
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const filtered = query ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()) && !selected.includes(o)) : options.filter(o => !selected.includes(o));
  const addActor = (name: string) => { onChange([...selected, name]); setQuery(''); };
  const removeActor = (name: string) => onChange(selected.filter(a => a !== name));
  return (
    <div className="mb-3 relative">
      <label className="text-sm font-medium text-foreground block mb-1">Actors</label>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {selected.map(a => (
          <span key={a} className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent/20 text-accent text-xs rounded-full">
            {a} <button type="button" onClick={() => removeActor(a)} className="hover:text-foreground"><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input value={query} onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Search actors..."
          className="w-full pl-9 pr-4 py-2 bg-secondary rounded-[24px] text-foreground text-sm outline-none focus:ring-2 focus:ring-ring border border-border" />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto bg-card border border-border rounded-[12px] shadow-lg">
          {filtered.slice(0, 8).map(o => (
            <button key={o} type="button" onMouseDown={() => addActor(o)}
              className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors first:rounded-t-[12px] last:rounded-b-[12px]">
              {o}
            </button>
          ))}
        </div>
      )}
      {query && !options.includes(query) && (
        <button type="button" onMouseDown={() => addActor(query)}
          className="mt-1 text-xs text-accent hover:underline">+ Add "{query}" as new actor</button>
      )}
    </div>
  );
}

// ── Category multi-select (same pattern as ActorMultiSelect) ──
function CategoryMultiSelect({ selected, onChange, options }: {
  selected: string[]; onChange: (v: string[]) => void; options: string[];
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const filtered = query
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()) && !selected.includes(o))
    : options.filter(o => !selected.includes(o));
  const addCat = (name: string) => { onChange([...selected, name]); setQuery(''); };
  const removeCat = (name: string) => onChange(selected.filter(c => c !== name));
  return (
    <div className="mb-3 relative">
      <label className="text-sm font-medium text-foreground block mb-1">Categories</label>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {selected.map(c => (
          <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/20 text-primary text-xs rounded-full">
            {c} <button type="button" onClick={() => removeCat(c)} className="hover:text-foreground"><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input value={query} onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Search categories..."
          className="w-full pl-9 pr-4 py-2 bg-secondary rounded-[24px] text-foreground text-sm outline-none focus:ring-2 focus:ring-ring border border-border" />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto bg-card border border-border rounded-[12px] shadow-lg">
          {filtered.slice(0, 10).map(o => (
            <button key={o} type="button" onMouseDown={() => addCat(o)}
              className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors first:rounded-t-[12px] last:rounded-b-[12px]">
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(() => {
    const currentUser = getCurrentUser();
    return currentUser;
  });
  
  // Initialize tab from URL query parameter, default to 'dashboard'
  const getInitialTab = (): AdminTab => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') as AdminTab;
    if (tabParam && ['dashboard', 'posts', 'channels', 'actors', 'categories', 'player-settings', 'settings'].includes(tabParam)) {
      return tabParam;
    }
    return 'dashboard';
  };
  
  const [tab, setTab] = useState<AdminTab>(getInitialTab);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tabLoading, setTabLoading] = useState<Record<AdminTab, boolean>>({
    dashboard: false,
    posts: false,
    channels: false,
    actors: false,
    categories: false,
    settings: false,
    'player-settings': false
  });

  const [cats, setCats] = useState<Category[]>([]);
  const [settings, setSettings] = useState(() => getSettings());
  const [playerSettings, setPlayerSettings] = useState<{ autoPlay: boolean; defaultServer: 'SERVER_01' | 'SERVER_02'; updatedAt: string }>({ autoPlay: true, defaultServer: 'SERVER_01', updatedAt: '' });
  const [modal, setModal] = useState<{ type: 'post' | 'channel' | 'actor' | 'category' | 'bulk'; mode: 'add' | 'edit'; data?: Post | Channel | Actor | Category } | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [formActors, setFormActors] = useState<string[]>([]);
  const [formCategories, setFormCategories] = useState<string[]>([]);
  const [fetchedThumbnail, setFetchedThumbnail] = useState<string | null>(null);

  // Pagination state for posts
  const [currentPage, setCurrentPage] = useState(1);
  const POSTS_PER_PAGE = 20;

  // Loading animation state
  const [buttonLoading, setButtonLoading] = useState<Record<string, boolean>>({});
  const [buttonDone, setButtonDone] = useState<Record<string, boolean>>({});

  // Real data from backend/GitHub
  const [backendPosts, setBackendPosts] = useState<Post[]>([]);
  const [chs, setChs] = useState<Channel[]>([]);
  const [acts, setActs] = useState<Actor[]>([]);
  const [loadingBackend, setLoadingBackend] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Admin API calls now use credentials: 'include' for cookie-based auth

  // Post search
  const [postSearch, setPostSearch] = useState('');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkChannel, setBulkChannel] = useState('');
  const [bulkCategories, setBulkCategories] = useState<string[]>([]);
  const [bulkActors, setBulkActors] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<'channel' | 'actors' | 'category' | 'delete'>('channel');
  const [isSaving, setIsSaving] = useState(false);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [channelSearch, setChannelSearch] = useState('');
  const [actorSearch, setActorSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');

  const fetchBackendPosts = async () => {
    setLoadingBackend(true);
    try {
      const j = await fetchAdminPosts();
      
      if (j.success && j.data) {
        // DIAGNOSTIC: Log EXACT data received from API
        console.log('=== ADMIN POSTS RECEIVED FROM API ===');
        console.log(`Total posts: ${j.data.length}`);
        j.data.slice(0, 5).forEach((post: any, index: number) => {
          console.log(`Post ${index + 1}: "${post.title}"`);
          console.log(`  - channelId: ${post.channelId || 'NULL'}`);
          console.log(`  - channelName: ${post.channelName || 'NULL'}`);
        });
        console.log('=======================================');
        
        // Clean titles on load - remove ALL video extensions
        const cleaned = j.data.map((post: Post) => ({
          ...post,
          title: (post.title || '')
            .replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v|3gp|3g2|mpeg|mpg|ts|mts|m2ts|vob|ogv|rm|rmvb|asf|amv|divx|xvid|f4v|h264|h265|hevc|mxf|dv|qt|yuv|m2v|svi|nsv|roq|nut)\s*$/i, '')
            .replace(/\s+(mp4|mkv|avi|mov|wmv|flv|webm|m4v|3gp|3g2|mpeg|mpg|ts|mts|m2ts|vob|ogv|rm|rmvb|asf|amv|divx|xvid|f4v|h264|h265|hevc|mxf|dv|qt|yuv|m2v|svi|nsv|roq|nut)\s*$/i, '')
            .trim()
        }));
        setBackendPosts(cleaned);
        toast.success(`Loaded ${cleaned.length} posts`);
      } else {
        toast.error('Failed to load posts: No data returned');
        setBackendPosts([]);
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      toast.error('Failed to load posts from backend');
      setBackendPosts([]);
    } finally {
      setLoadingBackend(false);
    }
  };

  const refreshAll = () => {
    fetchBackendPosts();
    fetchChannels().then(r => { if (r.success) setChs(r.data); }).catch(() => {});
    fetchActors().then(r => { if (r.success) setActs(r.data); }).catch(() => {});
  };

  // Load player settings
  useEffect(() => {
    if (tab === 'player-settings') {
      fetchAdminPlayerSettings()
        .then(response => {
          if (response.success) {
            setPlayerSettings(response.data);
          }
        })
        .catch(err => {
          console.error('Failed to load player settings:', err);
          toast.error('Failed to load player settings');
        });
    }
  }, [tab]);

  // Load categories from backend — load on mount AND when categories tab is active
  const loadCategories = () => {
    fetchCategories()
      .then(response => {
        if (response.success) {
          setCats(response.data);
        }
      })
      .catch(err => {
        console.error('Failed to load categories:', err);
      });
  };

  useEffect(() => {
    loadCategories(); // load on mount so category search works in post edit modal
  }, []);

  useEffect(() => {
    if (tab === 'categories') {
      loadCategories();
    }
  }, [tab]);

  const handleSavePlayerSettings = async () => {
    try {
      await updatePlayerSettings(playerSettings.autoPlay, playerSettings.defaultServer);
      toast.success('Player settings updated successfully!');
    } catch (err: any) {
      console.error('Failed to update player settings:', err);
      toast.error(err.message || 'Failed to update player settings');
    }
  };

  useEffect(() => { refreshAll(); }, []);
  
  // Reset to page 1 when post search changes (MOVED TO TOP - React hooks rule)
  useEffect(() => {
    setCurrentPage(1);
  }, [postSearch]);
  
  // Check authorization on mount and when user changes — redirect to /meow if not admin
  useEffect(() => { 
    if (!user?.isAdmin) {
      navigate('/meow', { replace: true }); 
    }
  }, [user, navigate]);
  
  // Preload data when switching tabs to prevent blank screens
  useEffect(() => {
    // Set loading state for the tab
    setTabLoading(prev => ({ ...prev, [tab]: true }));
    
    // Safety timeout: force clear loading after 5 seconds max
    const safetyTimeout = setTimeout(() => {
      console.warn('Safety timeout: Force clearing loading state for tab:', tab);
      setTabLoading(prev => ({ ...prev, [tab]: false }));
    }, 5000);
    
    const loadData = async () => {
      try {
        // Always clear loading state, even if no data needs to be loaded
        if (tab === 'posts') {
          // If posts not loaded yet, fetch them
          if (backendPosts.length === 0) {
            await fetchBackendPosts();
          }
        } else if (tab === 'channels') {
          if (chs.length === 0) {
            const r = await fetchChannels();
            if (r.success) setChs(r.data);
          }
        } else if (tab === 'actors') {
          if (acts.length === 0) {
            const r = await fetchActors();
            if (r.success) setActs(r.data);
          }
        } else if (tab === 'categories') {
          if (cats.length === 0) {
            const r = await fetchCategories();
            if (r.success) setCats(r.data);
          }
        }
      } catch (error) {
        console.error(`Error loading data for tab ${tab}:`, error);
        toast.error('Failed to load data');
      } finally {
        // ALWAYS clear loading state, even if no data was fetched
        clearTimeout(safetyTimeout);
        setTabLoading(prev => ({ ...prev, [tab]: false }));
      }
    };
    
    loadData();
    
    // Cleanup timeout on unmount
    return () => clearTimeout(safetyTimeout);
  }, [tab]);
  
  // Show loading while checking auth - NEVER return null (causes black screen!)
  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking authorization...</p>
        </div>
      </div>
    );
  }

  const sidebarItems: { id: AdminTab; icon: typeof BarChart3; label: string }[] = [
    { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
    { id: 'posts', icon: Film, label: 'Posts' },
    { id: 'channels', icon: Tv, label: 'Channels' },
    { id: 'actors', icon: Users, label: 'Actors' },
    { id: 'categories', icon: Tag, label: 'Categories' },
    { id: 'player-settings', icon: Settings, label: 'Player Settings' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  const stats = [
    { label: 'Total Videos', value: backendPosts.length, icon: Film, color: 'text-accent' },
    { label: 'Total Channels', value: chs.length, icon: Tv, color: 'text-primary' },
    { label: 'Total Actors', value: acts.length, icon: Users, color: 'text-accent' },
    { label: 'Total Categories', value: cats.filter(c => c.id !== 'all').length, icon: Tag, color: 'text-primary' },
  ];

  // Map platform to embed URL - Seekstreaming only
  const toEmbedUrl = (platform: string, videoId: string) => {
    if (platform === 'seekstreaming') return `${form.seekstreaming_player_domain || 'https://xonstream.seeks.cloud'}/#${videoId}`;
    return '';
  };
  const parseEmbedUrl = (url: string): { platform: string; videoId: string } | null => {
    if (!url) return null;
    if (url.includes('xonstream.seeks.cloud/#') || (url.includes('seeks.cloud/#'))) return { platform: 'seekstreaming', videoId: url.split('#')[1]?.split('&')[0] };
    return null;
  };

  const openAdd = (type: 'post' | 'channel' | 'actor' | 'category') => { 
    setForm({}); 
    if (type === 'post') {
      setFormActors([]);
      setFormCategories([]);
    }
    setModal({ type, mode: 'add' }); 
  };
  const openEdit = (type: 'post' | 'channel' | 'actor' | 'category', data: Post | Channel | Actor | Category) => {
    if (type === 'post') {
      const postData = data as Post;
      const cleanTitle = (postData.title || '').replace(/\.(mp4|mkv|avi|mov|wmv)$/i, '').trim();
      
      // Ensure categories are fresh when opening post edit modal
      loadCategories();
      
      const seekSrc = postData.videoSources?.find((s: any) => s.platform === 'seekstreaming');
      
      setForm({
        title: cleanTitle,
        thumbnail: postData.thumbnail || '',
        description: postData.description || '',
        channelName: postData.channelName || '',
        vid_seekstreaming: seekSrc?.videoId || '',
        vid_streamtape: postData.videoSources?.find((s: any) => s.platform === 'streamtape')?.videoId || '',
      });
      setFormActors(postData.actors || []);
      setFormCategories(postData.categories || []);
    } else {
      setForm({ ...data } as Record<string, string>);
    }
    setModal({ type, mode: 'edit', data });
  };

  const handleSavePost = async () => {
    // Build videoSources - Seekstreaming AND Streamtape
    const seekId = (form.vid_seekstreaming || '').trim();
    const streamtapeId = (form.vid_streamtape || '').trim();
    const updatedSources: VideoSourceInput[] = [];
    
    if (seekId) {
      updatedSources.push({ platform: 'seekstreaming', videoId: seekId });
    }
    if (streamtapeId) {
      updatedSources.push({ platform: 'streamtape', videoId: streamtapeId });
    }

    // Clean title - remove file extensions
    const cleanTitle = (form.title || '').replace(/\.(mp4|mkv|avi|mov|wmv)$/i, '').trim();

    // Find channel ID from name
    const channelId = chs.find(c => c.name === form.channelName)?.id || '';
    
    // Find category IDs from names  
    const categoryIds = formCategories.map(catName => cats.find(c => c.name === catName)?.id).filter(Boolean) as string[];

    const isEdit = modal?.mode === 'edit';
    const postId = modal?.data?.id;
    
    if (isEdit && !postId) {
      console.error('CRITICAL: Edit mode but no post ID!');
      toast.error('Error: No post ID found. Please refresh and try again.');
      return;
    }
    
    const payload = {
      title: cleanTitle,
      thumbnail: form.thumbnail || '',
      description: form.description || '',
      channelId: channelId,
      categoryIds: categoryIds,
      actors: formActors,
      videoSources: updatedSources,
    };
    
    setIsSaving(true);
    try {
      const resp = await fetch(`${API_BASE}/api/admin/posts${isEdit ? `/${postId}` : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const json = await resp.json();
      
      if (json.success) {
        // DIAGNOSTIC: Log what was saved
        console.log('=== POST SAVE SUCCESSFUL ===');
        console.log(`Post ID: ${postId || 'NEW'}`);
        console.log(`Channel ID sent: ${channelId || 'NULL'}`);
        console.log(`Channel Name sent: ${form.channelName || 'NULL'}`);
        console.log('Response:', json);
        console.log('=============================');
        
        toast.success(modal?.mode === 'edit' ? '✓ Post updated successfully!' : '✓ Post added successfully!');
        fetchBackendPosts();
        setModal(null);
      } else {
        toast.error(json.message || json.error || 'Save failed');
      }
    } catch (error) {
      console.error('Exception during save:', error);
      toast.error(`Could not reach backend: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!window.confirm('Delete this post from GitHub?')) return;
    try {
      const resp = await fetch(`${API_BASE}/api/admin/posts/${id}`, { method: 'DELETE', credentials: 'include' });
      const json = await resp.json();
      if (json.success) { toast.success('Post deleted from GitHub ✓'); fetchBackendPosts(); }
      else toast.error(json.error || 'Delete failed');
    } catch { toast.error('Could not reach backend'); }
  };

  const handleDeleteAllPosts = async () => {
    if (!window.confirm('WARNING: This will delete ALL posts from the database! This action cannot be undone. Continue?')) return;
    setLoadingBackend(true);
    try {
      const result = await deleteAllPosts();
      if (result.success) {
        toast.success(`Deleted all posts ✓`);
        setBackendPosts([]);
        setSelectedIds(new Set());
      } else {
        toast.error(result.message || 'Delete failed');
      }
    } catch (error) {
      console.error('Delete all error:', error);
      toast.error('Could not reach backend - check console for details');
    } finally {
      setLoadingBackend(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected posts from GitHub?`)) return;
    try {
      const idsArray = Array.from(selectedIds);
      const resp = await fetch(`${API_BASE}/api/admin/posts`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsArray }),
      });
      const json = await resp.json();
      if (json.success) {
        toast.success(`Deleted ${selectedIds.size} posts ✓`);
        setBackendPosts(backendPosts.filter(p => !selectedIds.has(p.id)));
        setSelectedIds(new Set());
      } else {
        toast.error(json.error || 'Delete failed');
      }
    } catch { toast.error('Could not reach backend'); }
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) {
      toast.error('No posts selected');
      return;
    }
    
    // Find channel ID from name
    let channelId: string | null = null;
    if (bulkAction === 'channel' && bulkChannel) {
      const foundChannel = chs.find(c => c.name === bulkChannel);
      channelId = foundChannel?.id || null;
      if (!channelId) {
        toast.error('Channel not found in database');
        return;
      }
    }
    
    // Find category IDs from names
    let categoryIds: string[] = [];
    if (bulkAction === 'category' && bulkCategories.length > 0) {
      categoryIds = bulkCategories.map(catName => {
        const foundCat = cats.find(c => c.name === catName);
        return foundCat?.id || null;
      }).filter(id => id !== null) as string[];
      
      if (categoryIds.length === 0) {
        toast.error('Categories not found in database');
        return;
      }
    }
    
    setIsBulkSaving(true);
    try {
      // Use the bulk-edit endpoint instead of individual updates
      const bulkPayload: any = {
        postIds: Array.from(selectedIds),
      };
      
      if (bulkAction === 'channel' && channelId) {
        bulkPayload.setChannel = channelId;
      }
      
      if (bulkAction === 'category' && categoryIds.length > 0) {
        // Send ALL category IDs, not just the first one
        bulkPayload.setCategories = categoryIds;
      }
      
      if (bulkAction === 'actors' && bulkActors.length > 0) {
        bulkPayload.addActors = bulkActors;
      }
      
      const resp = await fetch(`${API_BASE}/api/admin/posts/bulk-edit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bulkPayload),
      });
      
      const json = await resp.json();
      
      if (json.success) {
        const { updatedCount, errorCount, errors } = json.data || {};
        
        if (updatedCount > 0) {
          toast.success(`✓ Updated ${updatedCount} posts${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
          fetchBackendPosts();
          setSelectedIds(new Set());
          setModal(null);
        } else {
          toast.error('No posts were updated');
        }
      } else {
        toast.error(json.message || 'Failed to update posts');
      }
    } catch (err) {
      console.error('Bulk update error:', err);
      toast.error(`Could not reach backend: ${err.message || 'Unknown error'}`);
    } finally { 
      setIsBulkSaving(false);
    }
  };

  const handleCleanAllTitles = async () => {

    if (!window.confirm(`This will permanently remove .mp4, .mkv, .avi, .mov, .wmv from ALL post titles in GitHub. Continue?`)) return;
    
    setLoadingBackend(true);
    
    try {
      // Call backend endpoint to clean titles
      const response = await fetch(`${API_BASE}/api/admin/posts/clean-titles`, {
        method: 'POST',
        credentials: 'include',
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(result.message, {
          description: `${result.updated} updated, ${result.skipped} already clean`,
        });
        fetchBackendPosts(); // Refresh display with clean data from GitHub
      } else {
        toast.error(result.error || 'Title cleaning failed');
      }
      
    } catch (error) {
      console.error('Error cleaning titles:', error);
      toast.error('Failed to clean titles');
    } finally {
      setLoadingBackend(false);
    }
  };

  const handleSaveChannel = async () => {
    const existingChannel = modal?.data as Channel;
    const ch: Channel = modal?.mode === 'edit'
      ? { ...existingChannel, name: form.name || existingChannel.name, handle: form.handle || existingChannel.handle, logo: form.logo || existingChannel.logo, banner: form.banner || existingChannel.banner, description: form.description || existingChannel.description }
      : { id: `ch-${Date.now()}`, name: form.name || '', handle: form.handle || '', logo: form.logo || '', banner: form.banner || '', description: form.description || '', subscribers: 0, totalVideos: 0, verified: false };
    try {
      const r = await saveChannel(ch);
      if (r.success) {
        toast.success(modal?.mode === 'edit' ? 'Channel updated in GitHub ✓' : 'Channel added to GitHub ✓');
        fetchChannels().then(res => { if (res.success) setChs(res.data); }).catch(() => {});
        setModal(null);
      } else toast.error('Save failed');
    } catch { toast.error('Could not reach backend'); }
  };

  const handleDeleteChannel = async (id: string) => {
    if (!window.confirm('Delete this channel from GitHub?')) return;
    try {
      const r = await deleteChannel(id);
      if (r.success) {
        toast.success('Channel deleted ✓');
        fetchChannels().then(res => { if (res.success) setChs(res.data); }).catch(() => {});
      } else toast.error('Delete failed');
    } catch { toast.error('Could not reach backend'); }
  };

  const handleSaveActor = async () => {
    const existingActor = modal?.data as Actor;
    const actor: Actor = modal?.mode === 'edit'
      ? {
          ...existingActor,
          name: form.name || existingActor.name,
          image: form.image || existingActor.image,
          cropX:    form.cropX    !== undefined ? Number(form.cropX)    : existingActor.cropX,
          cropY:    form.cropY    !== undefined ? Number(form.cropY)    : existingActor.cropY,
          cropZoom: form.cropZoom !== undefined ? Number(form.cropZoom) : existingActor.cropZoom,
        }
      : { id: `actor-${Date.now()}`, name: form.name || '', image: form.image || '', totalVideos: 0,
          cropX: Number(form.cropX ?? 50), cropY: Number(form.cropY ?? 50), cropZoom: Number(form.cropZoom ?? 1) };
    try {
      const r = await saveActor(actor);
      if (r.success) {
        toast.success(modal?.mode === 'edit' ? 'Actor updated in GitHub ✓' : 'Actor added to GitHub ✓');
        // Refresh local admin state
        fetchActors().then(res => { if (res.success) setActs(res.data); }).catch(() => {});
        // Invalidate React Query cache so ActorsPage/ActorPage/SearchPage immediately show updated crop
        queryClient.invalidateQueries({ queryKey: ['actors'] });
        setModal(null);
      } else toast.error('Save failed');
    } catch { toast.error('Could not reach backend'); }
  };

  const handleDeleteActor = async (id: string) => {
    if (!window.confirm('Delete this actor from GitHub?')) return;
    try {
      const r = await deleteActor(id);
      if (r.success) {
        toast.success('Actor deleted ✓');
        fetchActors().then(res => { if (res.success) setActs(res.data); }).catch(() => {});
      } else toast.error('Delete failed');
    } catch { toast.error('Could not reach backend'); }
  };


  const handleSaveCategory = async () => {
    const categoryData = {
      id: modal?.mode === 'edit' ? (modal.data as Category).id : `cat-${Date.now()}`,
      name: form.name || '',
      icon: form.icon || '📁'
    };
    
    try {
      await saveCategory(categoryData);
      toast.success(modal?.mode === 'edit' ? 'Category updated' : 'Category added');
      setModal(null);
      // Refresh categories list
      const response = await fetchCategories();
      if (response.success) setCats(response.data);
    } catch (err: any) {
      console.error('Failed to save category:', err);
      toast.error(err.message || 'Failed to save category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      await deleteCategory(id);
      toast.success('Category deleted');
      // Refresh categories list
      const response = await fetchCategories();
      if (response.success) setCats(response.data);
    } catch (err: any) {
      console.error('Failed to delete category:', err);
      toast.error(err.message || 'Failed to delete category');
    }
  };

  const handleSaveSettings = () => { saveSettings(settings); toast.success('Settings saved'); };
  const selectTab = (t: AdminTab) => { 
    setTab(t); 
    setSidebarOpen(false);
    // Update URL query parameter so refresh preserves the tab
    const params = new URLSearchParams(window.location.search);
    params.set('tab', t);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  };

  const SidebarContent = (
    <nav className="py-2 flex-1">
      {sidebarItems.map(item => (
        <button key={item.id} onClick={() => selectTab(item.id)}
          className={`flex items-center gap-3 px-4 py-3 w-full text-left transition-colors ${
            tab === item.id ? 'bg-secondary text-foreground font-medium' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
          }`}>
          <item.icon className="w-5 h-5" />
          <span className="text-sm">{item.label}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Loading Animations */}
      {buttonLoading.sync && <RocketLoader text="Syncing Posts" />}
      {buttonDone.sync && <DoneAnimation onComplete={() => setButtonDone(prev => ({ ...prev, sync: false }))} />}
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 bg-card border-r border-border flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">Admin Panel</h2>
          <p className="text-xs text-muted-foreground">Manage your content</p>
        </div>
        {SidebarContent}
        <div className="p-4 border-t border-border">
          <button onClick={async () => { await adminLogout(); signOut(); navigate('/meow'); }}
            className="flex items-center gap-3 text-sm text-destructive hover:text-destructive/80 transition-colors w-full">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-card border-b border-border flex items-center px-4 gap-3">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-full hover:bg-secondary">
          <Menu className="w-5 h-5 text-foreground" />
        </button>
        <h2 className="text-lg font-bold text-foreground">Admin</h2>
        <button onClick={async () => { await adminLogout(); signOut(); navigate('/meow'); }} className="ml-auto p-2 text-destructive">
          <LogOut className="w-5 h-5" />
        </button>
      </div>
      {sidebarOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-background/60" onClick={() => setSidebarOpen(false)} />
          <aside className="md:hidden fixed top-14 left-0 bottom-0 z-50 w-60 bg-card border-r border-border flex flex-col animate-slide-in-left">
            {SidebarContent}
          </aside>
        </>
      )}

      {/* Content */}
      <div className="flex-1 p-4 md:p-6 mt-14 md:mt-0 overflow-auto">
        {/* Loading indicator for tab */}
        {tabLoading[tab] && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-accent" />
            <span className="ml-3 text-muted-foreground">Loading...</span>
          </div>
        )}

        {tab === 'dashboard' && !tabLoading.dashboard && (
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground mb-6">Dashboard</h1>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
              {stats.map(s => (
                <div key={s.label} className="bg-card rounded-[12px] border border-border p-4 md:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs md:text-sm text-muted-foreground">{s.label}</span>
                    <s.icon className={`w-4 h-4 md:w-5 md:h-5 ${s.color}`} />
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-foreground">{s.value}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mb-6 flex-wrap">
              <button onClick={async () => {
                setButtonLoading(prev => ({ ...prev, sync: true }));
                setButtonDone(prev => ({ ...prev, sync: false }));
                try {
                  const result = await syncPosts();
                  if (result.success) {
                    const addedCount = result.data?.added || 0;
                    toast.success(addedCount > 0 ? `${addedCount} new post(s) synced ✓` : 'Everything is already synced ✓');
                    refreshAll();
                    setButtonLoading(prev => ({ ...prev, sync: false }));
                    setButtonDone(prev => ({ ...prev, sync: true }));
                  } else {
                    toast.error(result.message || 'Sync failed');
                    setButtonLoading(prev => ({ ...prev, sync: false }));
                  }
                } catch (error) {
                  console.error('Sync error:', error);
                  toast.error('Could not reach backend');
                  setButtonLoading(prev => ({ ...prev, sync: false }));
                }
              }}
                disabled={buttonLoading.sync}
                className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-[20px] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 min-w-[140px] justify-center">
                {buttonLoading.sync ? <Loader size="small" /> : <><RefreshCw className="w-4 h-4" /> Sync Posts</>}
              </button>
              <button onClick={async () => {
                if (!window.confirm('Are you sure you want to flush all cache? This will refresh all data from the database.')) return;
                setButtonLoading(prev => ({ ...prev, flush: true }));
                try {
                  const resp = await fetch(`${API_BASE}/api/admin/cache/flush`, {
                    method: 'POST',
                    credentials: 'include',
                  });
                  const json = await resp.json();
                  if (json.success) {
                    toast.success('Cache flushed successfully! ✓');
                    refreshAll();
                  } else {
                    toast.error(json.message || 'Failed to flush cache');
                  }
                } catch (error) {
                  console.error('Cache flush error:', error);
                  toast.error('Could not reach backend');
                } finally {
                  setButtonLoading(prev => ({ ...prev, flush: false }));
                }
              }}
                disabled={buttonLoading.flush}
                className="flex items-center gap-2 px-5 py-2.5 bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded-[20px] text-sm font-medium hover:bg-orange-500/30 transition-all shadow-lg hover:shadow-orange-500/30 disabled:opacity-50 min-w-[140px] justify-center">
                {buttonLoading.flush ? <Loader size="small" /> : <><RefreshCw className="w-4 h-4" /> Flush Cache</>}
              </button>
              <button onClick={async () => {
                setButtonLoading(prev => ({ ...prev, clean: true }));
                await handleCleanAllTitles();
                setButtonLoading(prev => ({ ...prev, clean: false }));
              }}
                disabled={buttonLoading.clean}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-[20px] text-sm font-medium hover:bg-purple-500/30 transition-all shadow-lg hover:shadow-purple-500/30 disabled:opacity-50 min-w-[140px] justify-center">
                {buttonLoading.clean ? <Loader size="small" /> : <><Sparkles className="w-4 h-4" /> Format File Fix</>}
              </button>
              <button onClick={async () => {
                setButtonLoading(prev => ({ ...prev, deleteAll: true }));
                await handleDeleteAllPosts();
                setButtonLoading(prev => ({ ...prev, deleteAll: false }));
              }}
                disabled={buttonLoading.deleteAll}
                className="flex items-center gap-2 px-5 py-2.5 bg-destructive text-destructive-foreground rounded-[20px] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 min-w-[140px] justify-center">
                {buttonLoading.deleteAll ? <Loader size="small" /> : <><Trash2 className="w-4 h-4" /> Delete All</>}
              </button>
            </div>
            <div className="bg-card rounded-[12px] border border-border p-4 md:p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Recent Activity</h3>
              <div className="space-y-3">
                {backendPosts.slice(0, 5).map(v => (
                  <div key={v.id} className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                    <span className="text-muted-foreground hidden sm:inline">Video:</span>
                    <span className="text-foreground font-medium truncate">{v.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {tab === 'posts' && !tabLoading.posts && (() => {
          const filteredPosts = postSearch.trim()
            ? backendPosts.filter(p =>
                p.title?.toLowerCase().includes(postSearch.toLowerCase()) ||
                p.channelName?.toLowerCase().includes(postSearch.toLowerCase())
              )
            : backendPosts;
          
          // Pagination logic
          const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
          const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
          const endIndex = startIndex + POSTS_PER_PAGE;
          const paginatedPosts = filteredPosts.slice(startIndex, endIndex);
          
          return (
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-foreground">Posts ({paginatedPosts.length}{postSearch ? ` of ${backendPosts.length}` : ''})</h1>
              <div className="flex gap-2 flex-wrap">
                {selectedIds.size > 0 && (
                  <>
                    <button onClick={() => { setBulkChannel(''); setBulkActors([]); setBulkAction('channel'); setModal({ type: 'bulk', mode: 'edit' }); }}
                      className="flex items-center gap-2 px-4 py-2 bg-accent/20 text-accent rounded-[20px] text-sm font-medium hover:bg-accent/30 transition-colors">
                      Bulk Edit ({selectedIds.size})
                    </button>
                    <button onClick={handleBulkDelete}
                      className="flex items-center gap-2 px-4 py-2 bg-destructive/20 text-destructive rounded-[20px] text-sm font-medium hover:bg-destructive/30 transition-colors">
                      <Trash2 className="w-4 h-4" /> Delete ({selectedIds.size})
                    </button>
                  </>
                )}
                <button onClick={() => { if (selectedIds.size === backendPosts.length) setSelectedIds(new Set()); else setSelectedIds(new Set(backendPosts.map(p => p.id))); }}
                  className="px-4 py-2 rounded-[20px] bg-secondary text-secondary-foreground text-sm font-medium hover:bg-tertiary transition-colors">
                  {selectedIds.size === backendPosts.length ? 'Deselect All' : 'Select All'}
                </button>
                <button onClick={fetchBackendPosts} title="Refresh" className="p-2 rounded-[20px] bg-secondary hover:bg-tertiary transition-colors">
                  <RefreshCw className={`w-4 h-4 text-secondary-foreground ${loadingBackend ? 'animate-spin' : ''}`} />
                </button>
                <button onClick={() => openAdd('post')} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-[20px] text-sm font-medium hover:opacity-90 transition-opacity">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>
            {/* Search box */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={postSearch}
                onChange={e => setPostSearch(e.target.value)}
                placeholder="Search posts by title or channel..."
                className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-[24px] text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              {postSearch && (
                <button onClick={() => setPostSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Loading indicator */}
            {loadingBackend && (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-8 h-8 animate-spin text-accent" />
                <span className="ml-3 text-muted-foreground">Loading posts...</span>
              </div>
            )}
            
            {/* Desktop Table */}
            <div className="hidden md:block bg-card rounded-[12px] border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-3 w-8"><input type="checkbox" checked={selectedIds.size === backendPosts.length && backendPosts.length > 0}
                      onChange={() => { if (selectedIds.size === backendPosts.length) setSelectedIds(new Set()); else setSelectedIds(new Set(backendPosts.map(p => p.id))); }}
                      className="accent-accent w-4 h-4" /></th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Thumbnail</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Title</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Channel</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Actors</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Category</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPosts.map(p => (
                    <tr key={p.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${selectedIds.has(p.id) ? 'bg-accent/5' : ''}`}>
                      <td className="p-3"><input type="checkbox" checked={selectedIds.has(p.id)}
                        onChange={() => { const s = new Set(selectedIds); if (s.has(p.id)) s.delete(p.id); else s.add(p.id); setSelectedIds(s); }}
                        className="accent-accent w-4 h-4" /></td>
                      <td className="p-3">
                        <Thumbnail post={p} />
                      </td>
                      <td className="p-3 text-foreground font-medium max-w-[200px] truncate">{p.title}</td>
                      <td className="p-3 text-muted-foreground">{p.channelName || '—'}</td>
                      <td className="p-3 text-muted-foreground text-xs">{(p.actors || []).join(', ') || '—'}</td>
                      <td className="p-3">
                        {(() => {
                          const cats = p.categories || [];
                          return cats.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {cats.map((c: string) => (
                                <span key={c} className="px-2 py-0.5 bg-primary/15 text-primary text-xs rounded-full truncate max-w-[90px]">{c}</span>
                              ))}
                            </div>
                          ) : <span className="text-muted-foreground text-xs">—</span>;
                        })()}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit('post', p)} className="p-1.5 rounded hover:bg-secondary transition-colors text-accent"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => handleDeletePost(p.id)} className="p-1.5 rounded hover:bg-secondary transition-colors text-destructive"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-3">
              {paginatedPosts.map(p => (
                <div key={p.id} className={`bg-card rounded-[12px] border border-border p-3 flex items-center gap-3 ${selectedIds.has(p.id) ? 'ring-2 ring-accent/40' : ''}`}>
                  <input type="checkbox" checked={selectedIds.has(p.id)}
                    onChange={() => { const s = new Set(selectedIds); if (s.has(p.id)) s.delete(p.id); else s.add(p.id); setSelectedIds(s); }}
                    className="accent-accent w-4 h-4 flex-shrink-0" />
                  <MobileThumbnail post={p} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{p.channelName || '—'}</p>
                    {(() => {
                      const cats = p.categories || [];
                      return cats.length > 0 ? (
                        <p className="text-xs text-primary/80 truncate">{cats.join(', ')}</p>
                      ) : null;
                    })()}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit('post', p)} className="p-1.5 rounded hover:bg-secondary text-accent"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDeletePost(p.id)} className="p-1.5 rounded hover:bg-secondary text-destructive"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-card border border-border rounded-[12px] text-sm font-medium text-foreground hover:bg-secondary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 rounded-[12px] text-sm font-medium transition-all ${
                        currentPage === page
                          ? 'bg-accent text-white shadow-lg shadow-accent/30'
                          : 'bg-card border border-border text-foreground hover:bg-secondary'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-card border border-border rounded-[12px] text-sm font-medium text-foreground hover:bg-secondary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
          );
        })()}

        {tab === 'channels' && !tabLoading.channels && (() => {
          const filteredChs = channelSearch.trim()
            ? chs.filter(ch => ch.name.toLowerCase().includes(channelSearch.toLowerCase()) || ch.handle?.toLowerCase().includes(channelSearch.toLowerCase()))
            : chs;
          return (
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-foreground">Channels ({filteredChs.length}{channelSearch ? ` of ${chs.length}` : ''})</h1>
              <button onClick={() => openAdd('channel')} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-[20px] text-sm font-medium hover:opacity-90 transition-opacity">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={channelSearch} onChange={e => setChannelSearch(e.target.value)} placeholder="Search channels by name or handle..." className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-[24px] text-foreground text-sm outline-none focus:ring-2 focus:ring-ring" />
              {channelSearch && <button onClick={() => setChannelSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredChs.map(ch => (
                <div key={ch.id} className="bg-card rounded-[12px] border border-border p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <img src={ch.logo} alt={ch.name} className="w-12 h-12 rounded-full" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{ch.name}</p>
                      <p className="text-xs text-muted-foreground">{ch.handle}</p>
                    </div>
                  </div>
                  {(() => { const count = backendPosts.filter(p => p.channelName === ch.name).length; const parts = []; if (count > 0) parts.push(`${count} videos`); if (ch.subscribers > 0) parts.push(`${ch.subscribers.toLocaleString()} subs`); return parts.length > 0 ? <p className="text-xs text-muted-foreground mb-3">{parts.join(' · ')}</p> : null; })()}
                  <div className="flex gap-2">
                    <button onClick={() => openEdit('channel', ch)} className="flex-1 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-[20px] hover:bg-secondary/80 transition-colors">Edit</button>
                    <button onClick={() => handleDeleteChannel(ch.id)} className="flex-1 py-1.5 text-xs bg-destructive/10 text-destructive rounded-[20px] hover:bg-destructive/20 transition-colors">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          );
        })()}

        {tab === 'actors' && !tabLoading.actors && (() => {
          const filteredActs = actorSearch.trim()
            ? acts.filter(a => a.name.toLowerCase().includes(actorSearch.toLowerCase()))
            : acts;
          return (
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-foreground">Actors ({filteredActs.length}{actorSearch ? ` of ${acts.length}` : ''})</h1>
              <button onClick={() => openAdd('actor')} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-[20px] text-sm font-medium hover:opacity-90 transition-opacity">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={actorSearch} onChange={e => setActorSearch(e.target.value)} placeholder="Search actors by name..." className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-[24px] text-foreground text-sm outline-none focus:ring-2 focus:ring-ring" />
              {actorSearch && <button onClick={() => setActorSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredActs.map(a => (
                <div key={a.id} className="bg-card rounded-[12px] border border-border p-3 text-center">
                  <img src={a.image} alt={a.name} className="w-16 h-16 rounded-full mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                  <div className="flex gap-1 mt-2">
                    <button onClick={() => openEdit('actor', a)} className="flex-1 py-1 text-xs bg-secondary rounded-[20px] hover:bg-secondary/80">Edit</button>
                    <button onClick={() => handleDeleteActor(a.id)} className="flex-1 py-1 text-xs bg-destructive/10 text-destructive rounded-[20px] hover:bg-destructive/20">Del</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          );
        })()}

        {tab === 'categories' && !tabLoading.categories && (() => {
          const filteredCats = categorySearch.trim()
            ? cats.filter(c => c.id !== 'all' && c.name.toLowerCase().includes(categorySearch.toLowerCase()))
            : cats.filter(c => c.id !== 'all');
          return (
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-foreground">Categories ({filteredCats.length}{categorySearch ? ` of ${cats.filter(c=>c.id!=='all').length}` : ''})</h1>
              <button onClick={() => openAdd('category')} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-[20px] text-sm font-medium hover:opacity-90 transition-opacity">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={categorySearch} onChange={e => setCategorySearch(e.target.value)} placeholder="Search categories..." className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-[24px] text-foreground text-sm outline-none focus:ring-2 focus:ring-ring" />
              {categorySearch && <button onClick={() => setCategorySearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredCats.map(cat => (
                <div key={cat.id} className="bg-card rounded-[12px] border border-border p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{cat.icon || '📁'}</span>
                    <span className="text-sm font-medium text-foreground">{cat.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit('category', cat)} className="p-1.5 rounded hover:bg-secondary"><Pencil className="w-4 h-4 text-accent" /></button>
                    <button onClick={() => handleDeleteCategory(cat.id)} className="p-1.5 rounded hover:bg-secondary"><Trash2 className="w-4 h-4 text-destructive" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          );
        })()}

        {tab === 'settings' && (
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground mb-6">Settings</h1>
            <div className="bg-card rounded-[12px] border border-border p-4 md:p-6 max-w-md space-y-6">
              <Field label="Site Name" value={settings.siteName} onChange={v => setSettings({ ...settings, siteName: v })} />
              <Field label="Site Logo URL" value={settings.siteLogo || ''} onChange={v => setSettings({ ...settings, siteLogo: v })} placeholder="https://..." />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Enable Authentication</p>
                  <p className="text-xs text-muted-foreground">Allow sign in / sign up</p>
                </div>
                <button onClick={() => setSettings({ ...settings, authEnabled: !settings.authEnabled })}
                  className={`w-11 h-6 rounded-full relative transition-colors ${settings.authEnabled ? 'bg-accent' : 'bg-muted'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-foreground rounded-full shadow transition-transform ${settings.authEnabled ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>
              <button onClick={async () => {
                setButtonLoading(prev => ({ ...prev, saveSettings: true }));
                await handleSaveSettings();
                setButtonLoading(prev => ({ ...prev, saveSettings: false }));
              }}
                disabled={buttonLoading.saveSettings}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-[20px] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 min-w-[140px] flex items-center justify-center">
                {buttonLoading.saveSettings ? <Loader size="small" /> : 'Save Settings'}
              </button>
            </div>
          </div>
        )}

        {tab === 'player-settings' && (
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground mb-6">Player Settings</h1>
            <div className="bg-card rounded-[12px] border border-border p-4 md:p-6 max-w-md space-y-6">
              {/* Auto-Play Setting */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-3">Auto-Play Videos</label>
                <p className="text-xs text-muted-foreground mb-4">Enable or disable automatic video playback when users open a video page.</p>
                
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPlayerSettings({ ...playerSettings, autoPlay: !playerSettings.autoPlay })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      playerSettings.autoPlay ? 'bg-accent' : 'bg-secondary'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        playerSettings.autoPlay ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-foreground">
                    {playerSettings.autoPlay ? 'Auto-play enabled' : 'Auto-play disabled'}
                  </span>
                </div>
              </div>

              {/* Default Server Setting */}
              <div className="pt-4 border-t border-border">
                <label className="text-sm font-medium text-foreground block mb-3">Default Video Server</label>
                <p className="text-xs text-muted-foreground mb-4">Select which server users will see by default when opening videos.</p>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPlayerSettings({ ...playerSettings, defaultServer: 'SERVER_01' })}
                    className={`flex-1 px-4 py-3 rounded-full text-sm font-medium transition-all ${
                      playerSettings.defaultServer === 'SERVER_01'
                        ? 'bg-accent text-white shadow-lg shadow-accent/30'
                        : 'bg-secondary text-secondary-foreground hover:bg-tertiary'
                    }`}
                  >
                    SERVER 01
                    <span className="block text-xs font-normal opacity-80 mt-0.5">Seekstreaming</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlayerSettings({ ...playerSettings, defaultServer: 'SERVER_02' })}
                    className={`flex-1 px-4 py-3 rounded-full text-sm font-medium transition-all ${
                      playerSettings.defaultServer === 'SERVER_02'
                        ? 'bg-accent text-white shadow-lg shadow-accent/30'
                        : 'bg-secondary text-secondary-foreground hover:bg-tertiary'
                    }`}
                  >
                    SERVER 02
                    <span className="block text-xs font-normal opacity-80 mt-0.5">Streamtape</span>
                  </button>
                </div>
              </div>

              {playerSettings.updatedAt && (
                <p className="text-xs text-muted-foreground">
                  Last updated: {new Date(playerSettings.updatedAt).toLocaleString()}
                </p>
              )}

              <button 
                onClick={async () => {
                  setButtonLoading(prev => ({ ...prev, savePlayer: true }));
                  await handleSavePlayerSettings();
                  setButtonLoading(prev => ({ ...prev, savePlayer: false }));
                }}
                disabled={buttonLoading.savePlayer}
                className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-[20px] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center"
              >
                {buttonLoading.savePlayer ? <Loader size="small" /> : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <Modal open={modal?.type === 'post'} onClose={() => { setModal(null); setFetchedThumbnail(null); }} title={modal?.mode === 'edit' ? 'Edit Post' : 'Add Post'}>
        <Field label="Title" value={form.title || ''} onChange={v => setForm({ ...form, title: v })} />
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Thumbnail Path</label>
          <div className="flex gap-2">
            <input 
              value={form.thumbnail || ''} 
              onChange={e => setForm({ ...form, thumbnail: e.target.value })} 
              placeholder="/Kq3k4aG2NdH715EJVKCn7g/ox/9dr5kx6z/3ghr5r/capture-169616.jpg"
              className="flex-1 px-3 py-2 bg-background border border-border rounded-[8px] text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {form.thumbnail && (
              <img 
                src={buildThumbnailUrl(form.thumbnail)} 
                alt="Thumbnail preview" 
                className="w-16 h-9 rounded-[8px] object-cover border border-border"
                onError={(e) => {
                  e.currentTarget.src = 'https://via.placeholder.com/160x90?text=No+Thumbnail';
                }}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">Enter path only (e.g., /path/to/capture.jpg). Full URL will be built automatically.</p>
        </div>
        <TextAreaField label="Description" value={form.description || ''} onChange={v => setForm({ ...form, description: v })} placeholder="Enter video description..." />
        <SearchSelect label="Channel Name" value={form.channelName || ''} onChange={v => setForm({ ...form, channelName: v })}
          options={chs.map(c => c.name)} placeholder="Search channels..." />
        <ActorMultiSelect selected={formActors} onChange={setFormActors} options={acts.map(a => a.name)} />
        <CategoryMultiSelect selected={formCategories} onChange={setFormCategories} options={cats.filter(c => c.id !== 'all').map(c => c.name)} />

        {/* ── Video Source IDs (Seekstreaming + Streamtape) ── */}
        <div className="mb-3 mt-1">
          <label className="text-sm font-medium text-foreground block mb-1">Video Sources</label>
          <p className="text-xs text-muted-foreground mb-2">Add video IDs for each server. Fill in both for server switching.</p>
          
          {/* SERVER 01 - Seekstreaming */}
          <div className="flex items-center gap-2 mb-2">
            <div className="text-xs font-semibold text-purple-400 w-[100px] flex-shrink-0">
              <span className="block">SERVER 01</span>
              <span className="block text-[10px] opacity-70">Seekstreaming</span>
            </div>
            <input
              value={form.vid_seekstreaming || ''}
              onChange={e => setForm({ ...form, vid_seekstreaming: e.target.value })}
              placeholder="Seekstreaming video ID"
              className="flex-1 px-3 py-1.5 bg-secondary rounded-[20px] text-foreground text-xs outline-none focus:ring-2 focus:ring-ring border border-border"
            />
          </div>
          
          {/* SERVER 02 - Streamtape */}
          <div className="flex items-center gap-2">
            <div className="text-xs font-semibold text-blue-400 w-[100px] flex-shrink-0">
              <span className="block">SERVER 02</span>
              <span className="block text-[10px] opacity-70">Streamtape</span>
            </div>
            <input
              value={form.vid_streamtape || ''}
              onChange={e => setForm({ ...form, vid_streamtape: e.target.value })}
              placeholder="Streamtape video ID"
              className="flex-1 px-3 py-1.5 bg-secondary rounded-[20px] text-foreground text-xs outline-none focus:ring-2 focus:ring-ring border border-border"
            />
          </div>
        </div>

        <button onClick={handleSavePost} disabled={isSaving} className="w-full mt-2 py-2 bg-primary text-primary-foreground rounded-[20px] text-sm font-medium hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 min-h-[40px]">
          {isSaving ? <Loader size="small" /> : (modal?.mode === 'edit' ? 'Save Changes' : 'Add Post')}
        </button>
      </Modal>

      {/* ── Bulk Actions Modal ── */}
      <Modal open={modal?.type === 'bulk'} onClose={() => setModal(null)} title={`Bulk Edit (${selectedIds.size} posts)`}>
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['channel', 'category', 'actors'] as const).map(a => (
            <button key={a} onClick={() => setBulkAction(a)}
              className={`px-3 py-1.5 rounded-[20px] text-xs font-medium transition-colors ${bulkAction === a ? 'bg-accent text-white' : 'bg-secondary text-secondary-foreground hover:bg-tertiary'}`}>
              {a === 'channel' ? 'Change Channel' : a === 'category' ? 'Change Category' : 'Change Actors'}
            </button>
          ))}
        </div>
        {bulkAction === 'channel' && (
          <SearchSelect label="New Channel for selected posts" value={bulkChannel} onChange={setBulkChannel}
            options={chs.map(c => c.name)} placeholder="Search channels..." />
        )}
        {bulkAction === 'category' && (
          <CategoryMultiSelect
            selected={bulkCategories}
            onChange={setBulkCategories}
            options={cats.filter(c => c.name && c.name.toLowerCase() !== 'uncategorized').map(c => c.name)}
          />
        )}
        {bulkAction === 'actors' && (
          <ActorMultiSelect selected={bulkActors} onChange={setBulkActors} options={acts.map(a => a.name)} />
        )}
        <button onClick={async () => {
          if (bulkAction === 'delete') {
            await handleBulkDelete();
          } else {
            await handleBulkUpdate();
          }
        }} disabled={isBulkSaving} className={`w-full mt-4 py-2 rounded-[20px] text-sm font-medium hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 min-h-[40px] ${
          bulkAction === 'delete' ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground'
        }`}>
          {isBulkSaving ? <Loader size="small" /> : (bulkAction === 'delete' ? `Delete ${selectedIds.size} Posts` : `Apply to ${selectedIds.size} Posts`)}
        </button>
      </Modal>

      <Modal open={modal?.type === 'channel'} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Edit Channel' : 'Add Channel'}>
        <Field label="Name" value={form.name || ''} onChange={v => setForm({ ...form, name: v })} />
        <Field label="Handle" value={form.handle || ''} onChange={v => setForm({ ...form, handle: v })} placeholder="@handle" />
        <Field label="Logo URL" value={form.logo || ''} onChange={v => setForm({ ...form, logo: v })} />
        <Field label="Banner URL" value={form.banner || ''} onChange={v => setForm({ ...form, banner: v })} />
        <TextAreaField label="Description" value={form.description || ''} onChange={v => setForm({ ...form, description: v })} placeholder="Enter video description..." />
        <button onClick={async () => {
          setButtonLoading(prev => ({ ...prev, saveChannel: true }));
          await handleSaveChannel();
          setButtonLoading(prev => ({ ...prev, saveChannel: false }));
        }}
          disabled={buttonLoading.saveChannel}
          className="w-full mt-2 py-2 bg-primary text-primary-foreground rounded-[20px] text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center min-h-[40px]">
          {buttonLoading.saveChannel ? <Loader size="small" /> : (modal?.mode === 'edit' ? 'Save Changes' : 'Add Channel')}
        </button>
      </Modal>

      <Modal open={modal?.type === 'actor'} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Edit Actor' : 'Add Actor'}>
        <Field label="Name" value={form.name || ''} onChange={v => setForm({ ...form, name: v })} />
        <Field label="Image URL" value={form.image || ''} onChange={v => setForm({ ...form, image: v })} placeholder="https://..." />

        {/* Live Crop Preview */}
        {form.image && (
          <div className="mb-3">
            <label className="text-sm font-medium text-foreground block mb-2">Face Crop Preview</label>
            <div className="flex flex-col items-center gap-4">
              {/* Circular crop preview */}
              <div style={{ width: 140, height: 140, borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--border)', flexShrink: 0, background: 'var(--secondary)' }}>
                <div style={{
                  width: '100%', height: '100%',
                  backgroundImage: `url(${form.image})`,
                  backgroundSize: `${Math.round((Number(form.cropZoom) || 1) * 100)}%`,
                  backgroundPosition: `${form.cropX ?? 50}% ${form.cropY ?? 50}%`,
                  backgroundRepeat: 'no-repeat',
                }} />
              </div>
              {/* Sliders */}
              <div className="w-full space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>🔍 Zoom</span>
                    <span>{(Number(form.cropZoom) || 1).toFixed(1)}×</span>
                  </div>
                  <input type="range" min="1" max="3" step="0.05"
                    value={form.cropZoom ?? '1'}
                    onChange={e => setForm({ ...form, cropZoom: e.target.value })}
                    className="w-full h-2 appearance-none bg-secondary rounded-full cursor-pointer accent-accent" />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>↔ Horizontal</span>
                    <span>{form.cropX ?? 50}%</span>
                  </div>
                  <input type="range" min="0" max="100" step="1"
                    value={form.cropX ?? '50'}
                    onChange={e => setForm({ ...form, cropX: e.target.value })}
                    className="w-full h-2 appearance-none bg-secondary rounded-full cursor-pointer accent-accent" />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>↕ Vertical</span>
                    <span>{form.cropY ?? 50}%</span>
                  </div>
                  <input type="range" min="0" max="100" step="1"
                    value={form.cropY ?? '50'}
                    onChange={e => setForm({ ...form, cropY: e.target.value })}
                    className="w-full h-2 appearance-none bg-secondary rounded-full cursor-pointer accent-accent" />
                </div>
              </div>
            </div>
          </div>
        )}

        <button onClick={async () => {
          setButtonLoading(prev => ({ ...prev, saveActor: true }));
          await handleSaveActor();
          setButtonLoading(prev => ({ ...prev, saveActor: false }));
        }}
          disabled={buttonLoading.saveActor}
          className="w-full mt-2 py-2 bg-primary text-primary-foreground rounded-[20px] text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center min-h-[40px]">
          {buttonLoading.saveActor ? <Loader size="small" /> : (modal?.mode === 'edit' ? 'Save Changes' : 'Add Actor')}
        </button>
      </Modal>

      <Modal open={modal?.type === 'category'} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Edit Category' : 'Add Category'}>
        <Field label="Name" value={form.name || ''} onChange={v => setForm({ ...form, name: v })} />
        <Field label="Icon (emoji)" value={form.icon || ''} onChange={v => setForm({ ...form, icon: v })} placeholder="🎵" />
        <button onClick={async () => {
          setButtonLoading(prev => ({ ...prev, saveCategory: true }));
          await handleSaveCategory();
          setButtonLoading(prev => ({ ...prev, saveCategory: false }));
        }}
          disabled={buttonLoading.saveCategory}
          className="w-full mt-2 py-2 bg-primary text-primary-foreground rounded-[20px] text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center min-h-[40px]">
          {buttonLoading.saveCategory ? <Loader size="small" /> : (modal?.mode === 'edit' ? 'Save Changes' : 'Add Category')}
        </button>
      </Modal>
    </div>
  );
}
