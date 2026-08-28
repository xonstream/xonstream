import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, signOut, getSettings, saveSettings } from '@/lib/store';
import { 
  API_BASE, 
  fetchAdminPosts, 
  fetchChannels, 
  fetchActors, 
  saveChannel, 
  saveActor, 
  deleteChannel, 
  deleteActor, 
  fetchAdminPlayerSettings, 
  updatePlayerSettings, 
  fetchCategories, 
  saveCategory, 
  deleteCategory, 
  savePost,
  deletePost,
  bulkDeletePosts,
  bulkEditPosts,
  bulkDeleteChannels,
  bulkCreateChannels,
  bulkDeleteActors,
  bulkCreateActors,
  bulkDeleteCategories,
  bulkCreateCategories,
  adminLogout,
  fetchStreamtapeVideos,
  createStreamtapePost,
  bulkCreateStreamtapePosts,
  optimizeDatabaseStorage,
  type StreamtapeVideoItem,
  type PlayerSettings
} from '@/lib/api';
import Loader from '@/components/Loader';
import type { Channel, Actor, Category, Post } from '@/lib/types';
import { 
  BarChart3, 
  Film, 
  Tv, 
  Users, 
  Tag, 
  Settings, 
  LogOut, 
  Plus, 
  Pencil, 
  Trash2, 
  Menu, 
  X, 
  RefreshCw, 
  Search, 
  Sparkles, 
  DownloadCloud, 
  CheckCircle2, 
  Video, 
  Check, 
  Layers, 
  Sliders, 
  ExternalLink, 
  ShieldCheck, 
  ChevronRight, 
  CheckSquare, 
  Square,
  AlertTriangle,
  FolderPlus,
  Play,
  Maximize2,
  Wand2
} from 'lucide-react';
import { toast } from 'sonner';
import { generateDescriptionOptions, type DescriptionOption } from '@/lib/descriptionGenerator';

type AdminTab = 'dashboard' | 'posts' | 'channels' | 'actors' | 'categories' | 'player-settings';

// Helper to build full thumbnail URL from path
function buildThumbnailUrl(thumbnailPath: string): string {
  if (!thumbnailPath) return '';
  if (thumbnailPath.startsWith('http://') || thumbnailPath.startsWith('https://')) {
    return thumbnailPath;
  }
  return `https://thumb.tapecontent.net/thumb/${thumbnailPath}/thumb.jpg`;
}

// ── Shared Modal Component ──────────────────────────────────────────────────
function Modal({ 
  open, 
  onClose, 
  title, 
  subtitle,
  children,
  maxWidth = 'max-w-xl'
}: { 
  open: boolean; 
  onClose: () => void; 
  title: string; 
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-150" 
      onClick={onClose}
    >
      <div 
        className={`bg-[#12131a]/95 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full ${maxWidth} max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col shadow-2xl shadow-black/80 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150`} 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">{title}</h2>
            {subtitle && <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Form Input Fields ────────────────────────────────────────────────────────
function Field({ 
  label, 
  value, 
  onChange, 
  placeholder, 
  type = 'text',
  hint
}: { 
  label: string; 
  value: string; 
  onChange: (v: string) => void; 
  placeholder?: string; 
  type?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">{label}</label>
      <input 
        type={type} 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        placeholder={placeholder}
        className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all placeholder:text-gray-500" 
      />
      {hint && <p className="text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
}

function TextAreaField({ 
  label, 
  value, 
  onChange, 
  placeholder, 
  rows = 3,
  hint
}: { 
  label: string; 
  value: string; 
  onChange: (v: string) => void; 
  placeholder?: string; 
  rows?: number;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">{label}</label>
      <textarea 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all placeholder:text-gray-500 resize-none" 
      />
      {hint && <p className="text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
}

// ── Search+Select Dropdown ───────────────────────────────────────────────────
function SearchSelect({ 
  label, 
  value, 
  onChange, 
  options, 
  placeholder 
}: { 
  label: string; 
  value: string; 
  onChange: (v: string) => void; 
  options: string[]; 
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = query ? options.filter(o => o.toLowerCase().includes(query.toLowerCase())) : options;
  return (
    <div className="space-y-1.5 relative">
      <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">{label}</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={open ? query : value}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => { setQuery(value); setOpen(true); }}
          onBlur={() => setTimeout(() => { setOpen(false); setQuery(''); }, 200)}
          placeholder={placeholder || `Search ${label.toLowerCase()}...`}
          className="w-full pl-9 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all placeholder:text-gray-500" 
        />
      </div>
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-52 overflow-y-auto bg-[#1a1b24] border border-white/15 rounded-xl shadow-2xl py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-2.5 text-xs text-muted-foreground italic">No matches found</div>
          ) : filtered.slice(0, 30).map(o => (
            <button 
              key={o} 
              type="button" 
              onMouseDown={() => { onChange(o); setQuery(''); setOpen(false); }}
              className="w-full text-left px-4 py-2 text-xs text-gray-200 hover:bg-accent/20 hover:text-accent font-medium transition-colors flex items-center justify-between"
            >
              <span>{o}</span>
              {value === o && <Check className="w-3.5 h-3.5 text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Real-time Search Category Tag Picker ──────────────────────────────────────
function CategorySearchPicker({
  label,
  options,
  selected,
  onChange
}: {
  label: string;
  options: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = query
    ? options.filter(o => o.name.toLowerCase().includes(query.toLowerCase()))
    : options;

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">{label}</label>
        <span className="text-[11px] text-accent font-mono">{selected.length} selected</span>
      </div>

      {/* Live search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Type to filter categories in real-time..."
          className="w-full pl-9 pr-8 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs outline-none focus:border-accent"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filtered Chips / Categories list */}
      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-black/30 border border-white/10 rounded-xl">
        {filtered.map(opt => {
          const isSelected = selected.includes(opt.id);
          return (
            <button
              type="button"
              key={opt.id}
              onClick={() => toggle(opt.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                isSelected
                  ? 'bg-accent text-white shadow-md shadow-accent/30 border border-accent'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/5'
              }`}
            >
              {isSelected && <Check className="w-3 h-3" />}
              <span>{opt.name}</span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="w-full py-2 text-center text-xs text-gray-500 italic">
            No matching categories for "{query}"
          </div>
        )}
      </div>
    </div>
  );
}

// ── Real-time Search Actor Autocomplete Picker ────────────────────────────────
function ActorSearchPicker({
  label,
  existingActors,
  selectedActors,
  onChange
}: {
  label: string;
  existingActors: { id: string; name: string; image?: string }[];
  selectedActors: string[];
  onChange: (actors: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = query.trim()
    ? existingActors.filter(a => 
        a.name.toLowerCase().includes(query.trim().toLowerCase()) &&
        !selectedActors.some(sa => sa.toLowerCase() === a.name.toLowerCase())
      )
    : [];

  const addActor = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!selectedActors.some(a => a.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...selectedActors, trimmed]);
    }
    setQuery('');
    setOpen(false);
  };

  const removeActor = (name: string) => {
    onChange(selectedActors.filter(a => a !== name));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (filtered.length > 0) {
        addActor(filtered[0].name);
      } else if (query.trim()) {
        addActor(query.trim());
      }
    }
  };

  return (
    <div className="space-y-2 relative">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">{label}</label>
        <span className="text-[11px] text-pink-400 font-mono">{selectedActors.length} added</span>
      </div>

      {/* Selected Actor Badges */}
      {selectedActors.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-black/30 border border-white/10 rounded-xl">
          {selectedActors.map(actorName => (
            <span
              key={actorName}
              className="px-2.5 py-1 rounded-lg bg-pink-500/20 text-pink-200 border border-pink-500/30 text-xs font-semibold flex items-center gap-1.5"
            >
              <span>{actorName}</span>
              <button
                type="button"
                onClick={() => removeActor(actorName)}
                className="text-pink-300 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search Input with Real-time Dropdown */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Type to search existing actors or press Enter to add..."
          className="w-full pl-9 pr-16 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20"
        />
        {query.trim() && (
          <button
            type="button"
            onClick={() => addActor(query.trim())}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-[10px] font-bold"
          >
            Add
          </button>
        )}

        {/* Autocomplete dropdown */}
        {open && query.trim() && (
          <div className="absolute z-40 mt-1 w-full max-h-52 overflow-y-auto bg-[#1a1b24] border border-white/15 rounded-xl shadow-2xl py-1">
            {filtered.length > 0 ? (
              filtered.slice(0, 20).map(a => (
                <button
                  key={a.id}
                  type="button"
                  onMouseDown={() => addActor(a.name)}
                  className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-pink-500/20 hover:text-pink-300 font-medium transition-colors flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    {a.image ? (
                      <img src={a.image} alt={a.name} className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-pink-500/20 text-pink-300 flex items-center justify-center text-[10px] font-bold">
                        {a.name[0]}
                      </div>
                    )}
                    <span>{a.name}</span>
                  </div>
                  <span className="text-[10px] text-gray-400">Click to add</span>
                </button>
              ))
            ) : (
              <div 
                onMouseDown={() => addActor(query.trim())}
                className="px-3 py-2 text-xs text-pink-300 hover:bg-pink-500/20 cursor-pointer flex items-center justify-between"
              >
                <span>Add new actor: "<strong>{query.trim()}</strong>"</span>
                <span className="text-[10px] text-gray-400">Press Enter</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Multi-Select Checkbox Pill Group (for bulk assignment) ───────────────────
function MultiSelectChips({
  label,
  options,
  selected,
  onChange
}: {
  label: string;
  options: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">{label}</label>
      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-black/30 border border-white/10 rounded-xl">
        {options.map(opt => {
          const isSelected = selected.includes(opt.id);
          return (
            <button
              type="button"
              key={opt.id}
              onClick={() => toggle(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-accent text-white shadow-md shadow-accent/30 border border-accent'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/5'
              }`}
            >
              {isSelected ? <Check className="w-3 h-3" /> : null}
              {opt.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Admin Page Component ───────────────────────────────────────────────
export default function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Navigation State
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [postSubTab, setPostSubTab] = useState<'all' | 'streamtape'>('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Data States
  const [posts, setPosts] = useState<Post[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [actors, setActors] = useState<Actor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [streamtapeVideos, setStreamtapeVideos] = useState<StreamtapeVideoItem[]>([]);
  const [playerSettings, setPlayerSettings] = useState<PlayerSettings>({
    autoPlay: true,
    defaultServer: 'SERVER_01',
    updatedAt: ''
  });

  // Loading States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // Selection States for Bulk Actions
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedActors, setSelectedActors] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStreamtape, setSelectedStreamtape] = useState<string[]>([]);

  // Search & Filter States
  const [postSearch, setPostSearch] = useState('');
  const [postChannelFilter, setPostChannelFilter] = useState('all');
  const [postCategoryFilter, setPostCategoryFilter] = useState('all');
  const [channelSearch, setChannelSearch] = useState('');
  const [actorSearch, setActorSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [streamtapeSearch, setStreamtapeSearch] = useState('');

  // Pagination for posts
  const [page, setPage] = useState(1);
  const PER_PAGE = 24;

  // Modals
  const [modal, setModal] = useState<{
    type: 'post' | 'channel' | 'actor' | 'category' | 'bulk-category' | 'bulk-post-assign' | 'bulk-streamtape' | 'bulk-channel' | 'bulk-actor';
    mode: 'add' | 'edit';
    data?: any;
  } | null>(null);

  // Form State
  const [form, setForm] = useState<Record<string, any>>({});
  const [formCategories, setFormCategories] = useState<string[]>([]);
  const [formActors, setFormActors] = useState<string[]>([]);

  // AI Description Generator State
  const [descOptions, setDescOptions] = useState<DescriptionOption[] | null>(null);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

  // Explicit Streamtape Cloud Fetching State
  const [fetchingStreamtape, setFetchingStreamtape] = useState(false);

  // Actor Crop interactive tool state
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const [cropZoom, setCropZoom] = useState(1);

  // ── Data Fetching (Direct from Supabase) ──────────────────────────────────
  const fetchAllData = async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const [pRes, cRes, aRes, catRes, psRes] = await Promise.allSettled([
        fetchAdminPosts(),
        fetchChannels(),
        fetchActors(),
        fetchCategories(),
        fetchAdminPlayerSettings()
      ]);

      if (pRes.status === 'fulfilled' && pRes.value.success) {
        setPosts(pRes.value.data || []);
      }
      if (cRes.status === 'fulfilled' && cRes.value.success) {
        setChannels(cRes.value.data || []);
      }
      if (aRes.status === 'fulfilled' && aRes.value.success) {
        setActors(aRes.value.data || []);
      }
      if (catRes.status === 'fulfilled' && catRes.value.success) {
        setCategories(catRes.value.data || []);
      }
      if (psRes.status === 'fulfilled' && psRes.value.success && psRes.value.data) {
        setPlayerSettings(psRes.value.data);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
      toast.error('Failed to load some dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleFetchStreamtape = async () => {
    setFetchingStreamtape(true);
    try {
      const res = await fetchStreamtapeVideos();
      if (res.success) {
        setStreamtapeVideos(res.data || []);
        toast.success(`Fetched ${res.data?.length || 0} un-imported videos from Streamtape Cloud! ☁️`);
      } else {
        toast.error(res.message || 'Failed to fetch Streamtape videos');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error fetching Streamtape videos');
    } finally {
      setFetchingStreamtape(false);
    }
  };

  const [optimizingDB, setOptimizingDB] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);

  const handleOptimizeDatabase = async () => {
    setOptimizingDB(true);
    try {
      const res = await optimizeDatabaseStorage();
      if (res.success) {
        setOptimizationResult(res.stats);
        toast.success(res.message || 'Database storage optimized to minimal bytes!');
        fetchAllData(true);
      } else {
        toast.error(res.message || 'Optimization failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error running database optimization');
    } finally {
      setOptimizingDB(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const refreshAll = () => {
    fetchAllData();
    queryClient.invalidateQueries();
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await adminLogout();
    signOut();
    toast.success('Signed out successfully');
    navigate('/admingate');
  };

  // ── Filtering Logic ───────────────────────────────────────────────────────
  const filteredPosts = useMemo(() => {
    return posts.filter(p => {
      const matchesSearch = !postSearch.trim() || 
        p.title.toLowerCase().includes(postSearch.toLowerCase()) ||
        (p.channelName && p.channelName.toLowerCase().includes(postSearch.toLowerCase()));
      const matchesChannel = postChannelFilter === 'all' || p.channelName === postChannelFilter;
      const matchesCategory = postCategoryFilter === 'all' || 
        (p.categories && p.categories.includes(postCategoryFilter)) || 
        (p.category && p.category === postCategoryFilter);
      return matchesSearch && matchesChannel && matchesCategory;
    });
  }, [posts, postSearch, postChannelFilter, postCategoryFilter]);

  const paginatedPosts = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return filteredPosts.slice(start, start + PER_PAGE);
  }, [filteredPosts, page]);

  const totalPages = Math.ceil(filteredPosts.length / PER_PAGE) || 1;

  const filteredChannels = useMemo(() => {
    return channels.filter(c => 
      !channelSearch.trim() || 
      c.name.toLowerCase().includes(channelSearch.toLowerCase()) ||
      (c.handle && c.handle.toLowerCase().includes(channelSearch.toLowerCase()))
    );
  }, [channels, channelSearch]);

  const filteredActors = useMemo(() => {
    return actors.filter(a => 
      !actorSearch.trim() || 
      a.name.toLowerCase().includes(actorSearch.toLowerCase())
    );
  }, [actors, actorSearch]);

  const filteredCategories = useMemo(() => {
    return categories.filter(c => 
      !categorySearch.trim() || 
      c.name.toLowerCase().includes(categorySearch.toLowerCase())
    );
  }, [categories, categorySearch]);

  const filteredStreamtape = useMemo(() => {
    return streamtapeVideos.filter(v => 
      !streamtapeSearch.trim() || 
      v.title.toLowerCase().includes(streamtapeSearch.toLowerCase()) ||
      v.name.toLowerCase().includes(streamtapeSearch.toLowerCase())
    );
  }, [streamtapeVideos, streamtapeSearch]);

  // ── Single Operations ─────────────────────────────────────────────────────

  // Post Actions
  const handleOpenAddPost = () => {
    setForm({
      title: '',
      videoId: '',
      description: '',
      thumbnail: '',
      channelId: channels[0]?.id || '',
      channelName: channels[0]?.name || ''
    });
    setFormCategories([]);
    setFormActors([]);
    setDescOptions(null);
    setModal({ type: 'post', mode: 'add' });
  };

  const handleOpenEditPost = (p: Post) => {
    const primaryVideoId = p.videoSources?.[0]?.videoId || '';
    const ch = channels.find(c => c.name === p.channelName);
    
    // Find matching category IDs
    const matchedCatIds = categories
      .filter(c => (p.categories || []).includes(c.name) || p.category === c.name)
      .map(c => c.id);

    const rawDesc = p.description || '';
    const cleanDesc = (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(rawDesc.trim())) ? '' : rawDesc;

    setForm({
      id: p.id,
      title: p.title,
      description: cleanDesc,
      thumbnail: p.thumbnail || '',
      videoId: primaryVideoId,
      channelId: ch?.id || (p as any).channelId || '',
      channelName: p.channelName || ''
    });
    setFormCategories(matchedCatIds);
    setFormActors(p.actors || []);
    setDescOptions(null);
    setModal({ type: 'post', mode: 'edit', data: p });
  };

  const handleGenerateDescription = () => {
    if (!form.title?.trim()) {
      toast.error('Please enter a video title first');
      return;
    }
    setIsGeneratingDesc(true);
    setTimeout(() => {
      const matchedCatNames = categories
        .filter(c => formCategories.includes(c.id))
        .map(c => c.name);
      const options = generateDescriptionOptions({
        title: form.title,
        channelName: form.channelName,
        actors: formActors,
        categories: matchedCatNames,
      });
      setDescOptions(options);
      setIsGeneratingDesc(false);
      toast.success('Generated 4 thoughtful description options! ✨');
    }, 250);
  };

  const handleApplyDescription = (text: string) => {
    setForm(prev => ({ ...prev, description: text }));
    setDescOptions(null);
    toast.success('Description applied to post! ✨');
  };

  const handleSavePost = async () => {
    if (!form.title?.trim()) {
      toast.error('Title is required');
      return;
    }
    setActionLoading(prev => ({ ...prev, savePost: true }));
    try {
      const postPayload: any = {
        title: form.title.trim(),
        description: form.description || '',
        thumbnail: form.thumbnail || '',
        categoryIds: formCategories,
        actorNames: formActors,
        actors: formActors,
        channelId: form.channelId || null
      };

      if (form.channelName && !form.channelId) {
        const found = channels.find(c => c.name.toLowerCase() === form.channelName.toLowerCase());
        if (found) postPayload.channelId = found.id;
        else postPayload.channelName = form.channelName;
      }

      if (form.videoId) {
        postPayload.videoId = form.videoId.trim();
        postPayload.videoSources = [{
          platform: 'streamtape',
          videoId: form.videoId.trim()
        }];
      }

      if (modal?.mode === 'edit' && form.id) {
        postPayload.id = form.id;
      }

      const res = await savePost(postPayload);
      if (res.success) {
        toast.success(modal?.mode === 'edit' ? 'Post updated in Supabase ✓' : 'Post created in Supabase ✓');
        setModal(null);
        refreshAll();
      } else {
        toast.error(res.message || 'Failed to save post');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving post');
    } finally {
      setActionLoading(prev => ({ ...prev, savePost: false }));
    }
  };

  const handleDeletePost = async (id: string, title: string) => {
    if (!window.confirm(`Delete post "${title}"?`)) return;
    try {
      const res = await deletePost(id);
      if (res.success) {
        toast.success('Post deleted from Supabase ✓');
        setPosts(prev => prev.filter(p => p.id !== id));
        setSelectedPosts(prev => prev.filter(pId => pId !== id));
        refreshAll();
      } else {
        toast.error(res.message || 'Failed to delete post');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error deleting post');
    }
  };

  // Channel Actions
  const handleOpenAddChannel = () => {
    setForm({ name: '', handle: '', logo: '', banner: '', description: '', verified: true });
    setModal({ type: 'channel', mode: 'add' });
  };

  const handleOpenEditChannel = (ch: Channel) => {
    setForm({
      id: ch.id,
      name: ch.name,
      handle: ch.handle || '',
      logo: ch.logo || '',
      banner: ch.banner || '',
      description: ch.description || '',
      verified: ch.verified ?? true
    });
    setModal({ type: 'channel', mode: 'edit', data: ch });
  };

  const handleSaveChannel = async () => {
    if (!form.name?.trim()) {
      toast.error('Channel name is required');
      return;
    }
    setActionLoading(prev => ({ ...prev, saveChannel: true }));
    try {
      const res = await saveChannel(form as Channel);
      if (res.success) {
        toast.success(modal?.mode === 'edit' ? 'Channel updated in Supabase ✓' : 'Channel created in Supabase ✓');
        setModal(null);
        refreshAll();
      } else {
        toast.error(res.message || 'Failed to save channel');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving channel');
    } finally {
      setActionLoading(prev => ({ ...prev, saveChannel: false }));
    }
  };

  const handleDeleteChannel = async (id: string, name: string) => {
    if (!window.confirm(`Delete channel "${name}"? Posts linked to this channel will be uncategorized.`)) return;
    try {
      const res = await deleteChannel(id);
      if (res.success) {
        toast.success('Channel deleted from Supabase ✓');
        setChannels(prev => prev.filter(c => c.id !== id));
        setSelectedChannels(prev => prev.filter(cId => cId !== id));
        refreshAll();
      } else {
        toast.error(res.message || 'Failed to delete channel');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error deleting channel');
    }
  };

  // Actor Actions
  const handleOpenAddActor = () => {
    setForm({ name: '', image: '', bio: '' });
    setCropX(50);
    setCropY(50);
    setCropZoom(1);
    setModal({ type: 'actor', mode: 'add' });
  };

  const handleOpenEditActor = (actor: Actor) => {
    setForm({
      id: actor.id,
      name: actor.name,
      image: actor.image || '',
      bio: (actor as any).bio || ''
    });
    setCropX(actor.cropX ?? 50);
    setCropY(actor.cropY ?? 50);
    setCropZoom(actor.cropZoom ?? 1);
    setModal({ type: 'actor', mode: 'edit', data: actor });
  };

  const handleSaveActor = async () => {
    const actorName = form.name?.trim() || '';
    if (!actorName) {
      toast.error('Actor name is required');
      return;
    }

    const isEdit = modal?.mode === 'edit';
    const isDuplicate = actors.some(a => 
      (isEdit ? a.id !== form.id : true) && 
      a.name.trim().toLowerCase() === actorName.toLowerCase()
    );

    if (isDuplicate) {
      toast.error('Already created.');
      return;
    }

    setActionLoading(prev => ({ ...prev, saveActor: true }));
    try {
      const payload: any = {
        id: form.id || undefined,
        name: actorName,
        image: form.image || '',
        bio: form.bio || ''
      };
      const res = await saveActor(payload as Actor);
      if (res.success) {
        toast.success(modal?.mode === 'edit' ? 'Actor updated in Supabase ✓' : 'Actor created in Supabase ✓');
        const savedData = res.data || payload;
        if (modal?.mode === 'edit' && form.id) {
          setActors(prev => prev.map(a => a.id === form.id ? { ...a, ...savedData } : a));
        } else if (res.data) {
          setActors(prev => [res.data, ...prev]);
        }
        setModal(null);
        refreshAll();
      } else {
        toast.error(res.message || 'Failed to save actor');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving actor');
    } finally {
      setActionLoading(prev => ({ ...prev, saveActor: false }));
    }
  };

  const handleDeleteActor = async (id: string, name: string) => {
    if (!window.confirm(`Delete actor "${name}"?`)) return;
    try {
      const res = await deleteActor(id);
      if (res.success) {
        toast.success('Actor deleted from Supabase ✓');
        setActors(prev => prev.filter(a => a.id !== id));
        setSelectedActors(prev => prev.filter(aId => aId !== id));
        refreshAll();
      } else {
        toast.error(res.message || 'Failed to delete actor');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error deleting actor');
    }
  };

  // Category Actions
  const handleOpenAddCategory = () => {
    setForm({ name: '', icon: '' });
    setModal({ type: 'category', mode: 'add' });
  };

  const handleOpenEditCategory = (cat: Category) => {
    setForm({ id: cat.id, name: cat.name, icon: cat.icon || '' });
    setModal({ type: 'category', mode: 'edit', data: cat });
  };

  const handleSaveCategory = async () => {
    if (!form.name?.trim()) {
      toast.error('Category name is required');
      return;
    }
    setActionLoading(prev => ({ ...prev, saveCategory: true }));
    try {
      const res = await saveCategory(form as Category);
      if (res.success) {
        toast.success(modal?.mode === 'edit' ? 'Category updated in Supabase ✓' : 'Category created in Supabase ✓');
        setModal(null);
        refreshAll();
      } else {
        toast.error(res.message || 'Failed to save category');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving category');
    } finally {
      setActionLoading(prev => ({ ...prev, saveCategory: false }));
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!window.confirm(`Delete category "${name}"?`)) return;
    try {
      const res = await deleteCategory(id);
      if (res.success) {
        toast.success('Category deleted from Supabase ✓');
        setCategories(prev => prev.filter(c => c.id !== id));
        setSelectedCategories(prev => prev.filter(cId => cId !== id));
        refreshAll();
      } else {
        toast.error(res.message || 'Failed to delete category');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error deleting category');
    }
  };

  // ── Bulk Operations ───────────────────────────────────────────────────────

  // Bulk Delete Posts
  const handleBulkDeletePosts = async () => {
    if (selectedPosts.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedPosts.length} selected post(s) from Supabase?`)) return;

    setActionLoading(prev => ({ ...prev, bulkDeletePosts: true }));
    try {
      const res = await bulkDeletePosts(selectedPosts);
      if (res.success) {
        toast.success(`Deleted ${selectedPosts.length} posts from Supabase ✓`);
        setSelectedPosts([]);
        refreshAll();
      } else {
        toast.error(res.message || 'Bulk delete failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error in bulk delete');
    } finally {
      setActionLoading(prev => ({ ...prev, bulkDeletePosts: false }));
    }
  };

  // Bulk Edit / Assign Posts
  const handleBulkAssignPosts = async () => {
    if (selectedPosts.length === 0) return;
    setActionLoading(prev => ({ ...prev, bulkAssign: true }));
    try {
      const payload: any = { postIds: selectedPosts };
      if (form.bulkChannelId) payload.setChannel = form.bulkChannelId;
      if (formCategories.length > 0) payload.setCategories = formCategories;

      const res = await bulkEditPosts(payload);
      if (res.success) {
        toast.success(`Updated ${selectedPosts.length} posts in Supabase ✓`);
        setModal(null);
        setSelectedPosts([]);
        refreshAll();
      } else {
        toast.error(res.message || 'Bulk update failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating posts');
    } finally {
      setActionLoading(prev => ({ ...prev, bulkAssign: false }));
    }
  };

  // Bulk Delete Channels
  const handleBulkDeleteChannels = async () => {
    if (selectedChannels.length === 0) return;
    if (!window.confirm(`Delete ${selectedChannels.length} selected channels from Supabase?`)) return;

    setActionLoading(prev => ({ ...prev, bulkDeleteChannels: true }));
    try {
      const res = await bulkDeleteChannels(selectedChannels);
      if (res.success) {
        toast.success(`Deleted ${selectedChannels.length} channels from Supabase ✓`);
        setSelectedChannels([]);
        refreshAll();
      } else {
        toast.error(res.message || 'Bulk delete failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error in bulk delete');
    } finally {
      setActionLoading(prev => ({ ...prev, bulkDeleteChannels: false }));
    }
  };

  // Bulk Delete Actors
  const handleBulkDeleteActors = async () => {
    if (selectedActors.length === 0) return;
    if (!window.confirm(`Delete ${selectedActors.length} selected actors from Supabase?`)) return;

    setActionLoading(prev => ({ ...prev, bulkDeleteActors: true }));
    try {
      const res = await bulkDeleteActors(selectedActors);
      if (res.success) {
        toast.success(`Deleted ${selectedActors.length} actors from Supabase ✓`);
        setSelectedActors([]);
        refreshAll();
      } else {
        toast.error(res.message || 'Bulk delete failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error in bulk delete');
    } finally {
      setActionLoading(prev => ({ ...prev, bulkDeleteActors: false }));
    }
  };

  // Bulk Delete Categories
  const handleBulkDeleteCategories = async () => {
    if (selectedCategories.length === 0) return;
    if (!window.confirm(`Delete ${selectedCategories.length} selected categories from Supabase?`)) return;

    setActionLoading(prev => ({ ...prev, bulkDeleteCategories: true }));
    try {
      const res = await bulkDeleteCategories(selectedCategories);
      if (res.success) {
        toast.success(`Deleted ${selectedCategories.length} categories from Supabase ✓`);
        setSelectedCategories([]);
        refreshAll();
      } else {
        toast.error(res.message || 'Bulk delete failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error in bulk delete');
    } finally {
      setActionLoading(prev => ({ ...prev, bulkDeleteCategories: false }));
    }
  };

  // Bulk Create Categories
  const handleBulkCreateCategories = async () => {
    const rawNames = form.bulkNames || '';
    const names = rawNames
      .split(/[\n,]+/)
      .map((s: string) => s.trim())
      .filter(Boolean);

    if (names.length === 0) {
      toast.error('Please enter at least one category name');
      return;
    }

    setActionLoading(prev => ({ ...prev, bulkCreateCategories: true }));
    try {
      const res = await bulkCreateCategories(names);
      if (res.success) {
        toast.success(`Created ${res.count || names.length} categories in Supabase ✓`);
        setModal(null);
        refreshAll();
      } else {
        toast.error(res.message || 'Bulk category creation failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error creating categories');
    } finally {
      setActionLoading(prev => ({ ...prev, bulkCreateCategories: false }));
    }
  };

  // Bulk Create Channels
  const handleBulkCreateChannels = async () => {
    const rawInput = form.bulkNames || '';
    const lines = rawInput
      .split(/\n+/)
      .map((s: string) => s.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      toast.error('Please enter at least one channel name');
      return;
    }

    const items = lines.map((line: string) => {
      const parts = line.split('|').map((s: string) => s.trim());
      return {
        name: parts[0] || '',
        handle: parts[1] || '',
        description: parts[2] || '',
        verified: true
      };
    }).filter(c => c.name);

    setActionLoading(prev => ({ ...prev, bulkCreateChannels: true }));
    try {
      const res = await bulkCreateChannels({ items });
      if (res.success) {
        toast.success(`Created ${res.count || items.length} channels in Supabase ✓`);
        setModal(null);
        refreshAll();
      } else {
        toast.error(res.message || 'Bulk channel creation failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error creating channels');
    } finally {
      setActionLoading(prev => ({ ...prev, bulkCreateChannels: false }));
    }
  };

  // Bulk Create Actors
  const handleBulkCreateActors = async () => {
    const rawInput = form.bulkNames || '';
    const lines = rawInput
      .split(/[\n,]+/)
      .map((s: string) => s.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      toast.error('Please enter at least one actor name');
      return;
    }

    const existingNames = new Set(actors.map(a => a.name.trim().toLowerCase()));
    const seenInInput = new Set<string>();
    const items: any[] = [];

    for (const line of lines) {
      const parts = line.split('|').map((s: string) => s.trim());
      const name = parts[0] || '';
      if (!name) continue;
      const lower = name.toLowerCase();
      if (!existingNames.has(lower) && !seenInInput.has(lower)) {
        seenInInput.add(lower);
        items.push({
          name,
          image: parts[1] || '',
          cropX: 50,
          cropY: 50,
          cropZoom: 1
        });
      }
    }

    if (items.length === 0) {
      toast.error('Already created.');
      return;
    }

    setActionLoading(prev => ({ ...prev, bulkCreateActors: true }));
    try {
      const res = await bulkCreateActors({ items });
      if (res.success) {
        toast.success(`Created ${res.count || items.length} actors in Supabase ✓`);
        setModal(null);
        refreshAll();
      } else {
        toast.error(res.message || 'Bulk actor creation failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error creating actors');
    } finally {
      setActionLoading(prev => ({ ...prev, bulkCreateActors: false }));
    }
  };

  // Streamtape Single Import
  const handleImportStreamtapeSingle = async (video: StreamtapeVideoItem) => {
    setActionLoading(prev => ({ ...prev, [`st_${video.videoId}`]: true }));
    try {
      const res = await createStreamtapePost({
        title: video.title,
        videoId: video.videoId,
        thumbnail: video.thumbnail,
        channelId: channels[0]?.id || undefined,
        channelName: channels[0]?.name || undefined
      });
      if (res.success) {
        toast.success(`Imported "${video.title}" to Supabase ✓`);
        // Remove from un-imported cloud videos immediately
        setStreamtapeVideos(prev => prev.filter(v => v.videoId !== video.videoId));
        setSelectedStreamtape(prev => prev.filter(id => id !== video.videoId));
        refreshAll();
      } else {
        toast.error(res.message || 'Import failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error importing video');
    } finally {
      setActionLoading(prev => ({ ...prev, [`st_${video.videoId}`]: false }));
    }
  };

  // Streamtape Bulk Import
  const handleBulkImportStreamtape = async () => {
    if (selectedStreamtape.length === 0) return;
    setActionLoading(prev => ({ ...prev, bulkStreamtape: true }));
    try {
      const selectedItems = streamtapeVideos.filter(v => selectedStreamtape.includes(v.videoId));
      const res = await bulkCreateStreamtapePosts({
        videos: selectedItems.map(v => ({
          title: v.title,
          videoId: v.videoId,
          thumbnail: v.thumbnail
        })),
        channelId: form.bulkStreamtapeChannelId || undefined,
        categoryIds: formCategories
      });

      if (res.success) {
        toast.success(`Imported ${res.createdCount} videos to Supabase (${res.skippedCount} skipped) ✓`);
        // Remove imported items from cloud list
        setStreamtapeVideos(prev => prev.filter(v => !selectedStreamtape.includes(v.videoId)));
        setModal(null);
        setSelectedStreamtape([]);
        refreshAll();
      } else {
        toast.error(res.message || 'Bulk import failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error importing videos');
    } finally {
      setActionLoading(prev => ({ ...prev, bulkStreamtape: false }));
    }
  };

  // Player Settings Save
  const handleSavePlayerSettings = async () => {
    setActionLoading(prev => ({ ...prev, savePlayer: true }));
    try {
      const res = await updatePlayerSettings(playerSettings.autoPlay, playerSettings.defaultServer);
      if (res.success) {
        toast.success('Player settings saved in Supabase ✓');
        setPlayerSettings(res.data);
      } else {
        toast.error(res.message || 'Failed to update player settings');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating player settings');
    } finally {
      setActionLoading(prev => ({ ...prev, savePlayer: false }));
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b10] text-gray-100 flex flex-col md:flex-row antialiased selection:bg-accent selection:text-white">
      
      {/* ── Sidebar Navigation ─────────────────────────────────────────────── */}
      <aside className={`
        fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-[#0e0f17]/95 backdrop-blur-2xl border-r border-white/[0.08] 
        flex flex-col justify-between transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div>
          {/* Logo Brand Header */}
          <div className="p-6 border-b border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-accent to-purple-400 flex items-center justify-center shadow-lg shadow-accent/25">
                <Play className="w-4 h-4 text-white fill-current" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white tracking-wide">XON STREAM</h1>
                <p className="text-[10px] text-accent font-semibold tracking-widest uppercase">Admin Console</p>
              </div>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)} 
              className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => { setTab('dashboard'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                tab === 'dashboard'
                  ? 'bg-gradient-to-r from-accent/20 to-purple-500/10 text-white border border-accent/40 shadow-lg shadow-accent/15'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-3">
                <BarChart3 className={`w-4 h-4 ${tab === 'dashboard' ? 'text-accent' : 'text-gray-400'}`} />
                <span>Overview</span>
              </div>
            </button>

            <button
              onClick={() => { setTab('posts'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                tab === 'posts'
                  ? 'bg-gradient-to-r from-accent/20 to-purple-500/10 text-white border border-accent/40 shadow-lg shadow-accent/15'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Film className={`w-4 h-4 ${tab === 'posts' ? 'text-accent' : 'text-gray-400'}`} />
                <span>Posts & Media</span>
              </div>
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-white/10 text-gray-300 font-mono">
                {posts.length}
              </span>
            </button>

            <button
              onClick={() => { setTab('channels'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                tab === 'channels'
                  ? 'bg-gradient-to-r from-accent/20 to-purple-500/10 text-white border border-accent/40 shadow-lg shadow-accent/15'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Tv className={`w-4 h-4 ${tab === 'channels' ? 'text-accent' : 'text-gray-400'}`} />
                <span>Channels</span>
              </div>
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-white/10 text-gray-300 font-mono">
                {channels.length}
              </span>
            </button>

            <button
              onClick={() => { setTab('actors'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                tab === 'actors'
                  ? 'bg-gradient-to-r from-accent/20 to-purple-500/10 text-white border border-accent/40 shadow-lg shadow-accent/15'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className={`w-4 h-4 ${tab === 'actors' ? 'text-accent' : 'text-gray-400'}`} />
                <span>Actors</span>
              </div>
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-white/10 text-gray-300 font-mono">
                {actors.length}
              </span>
            </button>

            <button
              onClick={() => { setTab('categories'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                tab === 'categories'
                  ? 'bg-gradient-to-r from-accent/20 to-purple-500/10 text-white border border-accent/40 shadow-lg shadow-accent/15'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Tag className={`w-4 h-4 ${tab === 'categories' ? 'text-accent' : 'text-gray-400'}`} />
                <span>Categories</span>
              </div>
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-white/10 text-gray-300 font-mono">
                {categories.length}
              </span>
            </button>

            <button
              onClick={() => { setTab('player-settings'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                tab === 'player-settings'
                  ? 'bg-gradient-to-r from-accent/20 to-purple-500/10 text-white border border-accent/40 shadow-lg shadow-accent/15'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Sliders className={`w-4 h-4 ${tab === 'player-settings' ? 'text-accent' : 'text-gray-400'}`} />
                <span>Player Settings</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] text-gray-400">Supabase Real-Time</span>
            </div>
            <button 
              onClick={refreshAll} 
              disabled={refreshing}
              title="Refresh Data"
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-accent' : ''}`} />
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile drawer */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      {/* ── Main Content Area ──────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 pb-28 md:pb-12">
        
        {/* Top Sticky Header */}
        <header className="sticky top-0 z-20 h-16 bg-[#0a0b10]/80 backdrop-blur-xl border-b border-white/[0.08] px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl bg-white/5 text-gray-300 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <h2 className="text-sm md:text-base font-bold text-white capitalize tracking-wide">
                {tab.replace('-', ' ')}
              </h2>
              <span className="text-gray-500 text-xs hidden sm:inline">•</span>
              <span className="text-xs text-gray-400 hidden sm:inline">Admin Management Console</span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <button 
              onClick={() => navigate('/')} 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium border border-white/5 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">View Site</span>
            </button>
            <button 
              onClick={refreshAll} 
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-accent/15 hover:bg-accent/25 text-accent text-xs font-semibold border border-accent/30 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{refreshing ? 'Syncing...' : 'Live Sync'}</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-4 md:p-8 max-w-7xl w-full mx-auto space-y-6">

          {/* ────────────────────────────────────────────────────────────────
              TAB 1: DASHBOARD OVERVIEW
          ────────────────────────────────────────────────────────────────── */}
          {tab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Stat Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-accent/40 transition-all shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Posts</span>
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                      <Film className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl md:text-3xl font-extrabold text-white mt-3 font-mono">{posts.length}</p>
                  <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Live in Supabase
                  </p>
                </div>

                <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-accent/40 transition-all shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Channels</span>
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                      <Tv className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl md:text-3xl font-extrabold text-white mt-3 font-mono">{channels.length}</p>
                  <p className="text-[11px] text-gray-400 mt-1">Configured creators</p>
                </div>

                <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-accent/40 transition-all shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Actors</span>
                    <div className="w-9 h-9 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center border border-pink-500/20">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl md:text-3xl font-extrabold text-white mt-3 font-mono">{actors.length}</p>
                  <p className="text-[11px] text-gray-400 mt-1">Profiles with focal crop</p>
                </div>

                <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-accent/40 transition-all shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Categories</span>
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                      <Tag className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl md:text-3xl font-extrabold text-white mt-3 font-mono">{categories.length}</p>
                  <p className="text-[11px] text-gray-400 mt-1">Taxonomy tags</p>
                </div>
              </div>

              {/* Quick Launch Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={handleOpenAddPost}
                  className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 via-white/[0.02] to-transparent border border-purple-500/20 hover:border-purple-500/50 text-left group transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-accent/20 text-accent flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Plus className="w-5 h-5" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-sm font-bold text-white mt-4">Create New Post</h3>
                  <p className="text-xs text-gray-400 mt-1">Publish a new video with actors, channel, and streamtape source.</p>
                </button>

                <button
                  onClick={() => { setTab('posts'); setPostSubTab('streamtape'); }}
                  className="p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 via-white/[0.02] to-transparent border border-blue-500/20 hover:border-blue-500/50 text-left group transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <DownloadCloud className="w-5 h-5" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-sm font-bold text-white mt-4">Streamtape Cloud Import</h3>
                  <p className="text-xs text-gray-400 mt-1">Browse {streamtapeVideos.length} remote cloud videos and batch import.</p>
                </button>

                <button
                  onClick={() => { setForm({ bulkNames: '' }); setModal({ type: 'bulk-category', mode: 'add' }); }}
                  className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-white/[0.02] to-transparent border border-emerald-500/20 hover:border-emerald-500/50 text-left group transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FolderPlus className="w-5 h-5" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-sm font-bold text-white mt-4">Bulk Add Categories</h3>
                  <p className="text-xs text-gray-400 mt-1">Batch insert multiple tags and categories in one click.</p>
                </button>
              </div>

              {/* Recent Activity Table */}
              <div className="bg-[#12131a]/80 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Film className="w-4 h-4 text-accent" /> Recent Published Videos
                  </h3>
                  <button 
                    onClick={() => setTab('posts')}
                    className="text-xs text-accent hover:underline font-semibold"
                  >
                    View All ({posts.length}) →
                  </button>
                </div>

                <div className="divide-y divide-white/5">
                  {posts.slice(0, 6).map(p => (
                    <div key={p.id} className="py-3 flex items-center justify-between gap-4 group">
                      <div className="flex items-center gap-3 min-w-0">
                        <img 
                          src={buildThumbnailUrl(p.thumbnail)} 
                          alt={p.title}
                          className="w-14 h-9 rounded-lg object-cover bg-white/5 flex-shrink-0"
                          onError={e => { e.currentTarget.src = 'https://xonstream.qzz.io/siteicon.ico'; }}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{p.title}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {p.channelName || 'Unassigned'} • {p.categories?.join(', ') || p.category || 'No Category'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenEditPost(p)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePost(p.id, p.title)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {posts.length === 0 && (
                    <p className="text-xs text-muted-foreground py-6 text-center">No posts found in database.</p>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ────────────────────────────────────────────────────────────────
              TAB 2: POSTS & STREAMTAPE CLOUD
          ────────────────────────────────────────────────────────────────── */}
          {tab === 'posts' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Top Sub-Navigation Header */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#12131a]/80 border border-white/10 p-3 rounded-2xl">
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                  <button
                    onClick={() => setPostSubTab('all')}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                      postSubTab === 'all'
                        ? 'bg-accent text-white shadow-md shadow-accent/25'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Published ({posts.length})
                  </button>
                  <button
                    onClick={() => setPostSubTab('streamtape')}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      postSubTab === 'streamtape'
                        ? 'bg-accent text-white shadow-md shadow-accent/25'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <DownloadCloud className="w-3.5 h-3.5" />
                    <span>New Cloud Videos ({streamtapeVideos.length})</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {postSubTab === 'all' ? (
                    <button
                      onClick={handleOpenAddPost}
                      className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl text-xs font-semibold shadow-lg shadow-accent/25 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>New Post</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (selectedStreamtape.length === 0) {
                          toast.error('Select at least one video to import');
                          return;
                        }
                        setForm({ bulkStreamtapeChannelId: channels[0]?.id || '' });
                        setFormCategories([]);
                        setModal({ type: 'bulk-streamtape', mode: 'add' });
                      }}
                      disabled={selectedStreamtape.length === 0}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/25 transition-all"
                    >
                      <DownloadCloud className="w-4 h-4" />
                      <span>Bulk Import ({selectedStreamtape.length})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-Tab 2A: Published Posts */}
              {postSubTab === 'all' && (
                <div className="space-y-4">
                  {/* Search and Filters */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={postSearch}
                        onChange={e => { setPostSearch(e.target.value); setPage(1); }}
                        placeholder="Search posts by title or channel..."
                        className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder:text-gray-500 outline-none focus:border-accent"
                      />
                    </div>

                    <select
                      value={postChannelFilter}
                      onChange={e => { setPostChannelFilter(e.target.value); setPage(1); }}
                      className="px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-accent"
                    >
                      <option value="all">All Channels ({channels.length})</option>
                      {channels.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>

                    <select
                      value={postCategoryFilter}
                      onChange={e => { setPostCategoryFilter(e.target.value); setPage(1); }}
                      className="px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-accent"
                    >
                      <option value="all">All Categories ({categories.length})</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Post Table / Cards View */}
                  <div className="bg-[#12131a]/90 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                    
                    {/* Mobile Post Cards View (visible on screen < sm) */}
                    <div className="sm:hidden divide-y divide-white/5 p-2">
                      {paginatedPosts.map(post => {
                        const isSelected = selectedPosts.includes(post.id);
                        return (
                          <div 
                            key={post.id}
                            className={`p-3 rounded-xl transition-all ${
                              isSelected ? 'bg-accent/10 border border-accent/30' : 'hover:bg-white/[0.02]'
                            }`}
                          >
                            <div className="flex gap-3">
                              <div className="relative w-28 aspect-video rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
                                <img 
                                  src={buildThumbnailUrl(post.thumbnail)} 
                                  alt={post.title}
                                  className="w-full h-full object-cover"
                                  onError={e => { e.currentTarget.src = 'https://xonstream.qzz.io/siteicon.ico'; }}
                                />
                                <button
                                  onClick={() => {
                                    if (isSelected) setSelectedPosts(prev => prev.filter(id => id !== post.id));
                                    else setSelectedPosts(prev => [...prev, post.id]);
                                  }}
                                  className="absolute top-1.5 left-1.5 p-1 rounded-lg bg-black/70 backdrop-blur-md text-white"
                                >
                                  {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-accent" /> : <Square className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                              <div className="min-w-0 flex-1 flex flex-col justify-between">
                                <div>
                                  <h4 className="text-xs font-bold text-white line-clamp-2">{post.title}</h4>
                                  <p className="text-[10px] text-gray-400 mt-1 truncate">
                                    {post.channelName || 'No channel'} • {post.category || 'No category'}
                                  </p>
                                </div>
                                <div className="flex items-center justify-end gap-1.5 mt-2">
                                  <button
                                    onClick={() => handleOpenEditPost(post)}
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white"
                                    title="Edit"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePost(post.id, post.title)}
                                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {paginatedPosts.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground text-xs">
                          No matching posts found.
                        </div>
                      )}
                    </div>

                    {/* Desktop Table View (hidden on mobile, visible on sm+) */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-white/[0.03] border-b border-white/10 text-gray-400 uppercase font-semibold tracking-wider">
                          <tr>
                            <th className="p-4 w-12 text-center">
                              <button
                                onClick={() => {
                                  if (selectedPosts.length === paginatedPosts.length) {
                                    setSelectedPosts([]);
                                  } else {
                                    setSelectedPosts(paginatedPosts.map(p => p.id));
                                  }
                                }}
                                className="text-gray-400 hover:text-white"
                              >
                                {selectedPosts.length > 0 && selectedPosts.length === paginatedPosts.length ? (
                                  <CheckSquare className="w-4 h-4 text-accent" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </th>
                            <th className="p-4">Video</th>
                            <th className="p-4 hidden sm:table-cell">Channel</th>
                            <th className="p-4 hidden md:table-cell">Categories</th>
                            <th className="p-4 hidden lg:table-cell">Actors</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {paginatedPosts.map(post => {
                            const isSelected = selectedPosts.includes(post.id);
                            return (
                              <tr 
                                key={post.id} 
                                className={`hover:bg-white/[0.02] transition-colors ${isSelected ? 'bg-accent/10' : ''}`}
                              >
                                <td className="p-4 text-center">
                                  <button
                                    onClick={() => {
                                      if (isSelected) setSelectedPosts(prev => prev.filter(id => id !== post.id));
                                      else setSelectedPosts(prev => [...prev, post.id]);
                                    }}
                                    className="text-gray-400 hover:text-white"
                                  >
                                    {isSelected ? (
                                      <CheckSquare className="w-4 h-4 text-accent" />
                                    ) : (
                                      <Square className="w-4 h-4" />
                                    )}
                                  </button>
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center gap-3">
                                    <img 
                                      src={buildThumbnailUrl(post.thumbnail)} 
                                      alt={post.title} 
                                      className="w-16 h-10 rounded-lg object-cover bg-white/5 flex-shrink-0"
                                      onError={e => { e.currentTarget.src = 'https://xonstream.qzz.io/siteicon.ico'; }}
                                    />
                                    <div className="min-w-0 max-w-sm">
                                      <p className="font-semibold text-white truncate">{post.title}</p>
                                      <p className="text-[11px] text-gray-500 font-mono mt-0.5 truncate">
                                        ID: {post.id}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4 hidden sm:table-cell">
                                  <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-gray-300 font-medium">
                                    {post.channelName || '—'}
                                  </span>
                                </td>
                                <td className="p-4 hidden md:table-cell">
                                  <div className="flex flex-wrap gap-1 max-w-xs">
                                    {(post.categories && post.categories.length > 0) ? (
                                      post.categories.map(c => (
                                        <span key={c} className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px]">
                                          {c}
                                        </span>
                                      ))
                                    ) : post.category ? (
                                      <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px]">
                                        {post.category}
                                      </span>
                                    ) : (
                                      <span className="text-gray-500 text-[11px]">—</span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-4 hidden lg:table-cell">
                                  <div className="flex flex-wrap gap-1 max-w-xs">
                                    {post.actors && post.actors.length > 0 ? (
                                      post.actors.map(a => (
                                        <span key={a} className="px-2 py-0.5 rounded bg-pink-500/10 text-pink-300 border border-pink-500/20 text-[10px]">
                                          {a}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-gray-500 text-[11px]">—</span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleOpenEditPost(post)}
                                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white"
                                      title="Edit Post"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeletePost(post.id, post.title)}
                                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                                      title="Delete Post"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {paginatedPosts.length === 0 && (
                            <tr>
                              <td colSpan={6} className="p-12 text-center text-muted-foreground text-xs">
                                No matching posts found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Bar */}
                    {totalPages > 1 && (
                      <div className="p-4 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
                        <span>Showing {paginatedPosts.length} of {filteredPosts.length} posts</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30"
                          >
                            Prev
                          </button>
                          <span className="px-3 py-1.5 font-mono text-white">Page {page} of {totalPages}</span>
                          <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-Tab 2B: Streamtape Cloud Library */}
              {postSubTab === 'streamtape' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#12131a]/80 border border-white/10 p-4 rounded-2xl">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={streamtapeSearch}
                        onChange={e => setStreamtapeSearch(e.target.value)}
                        placeholder="Search cloud videos..."
                        className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder:text-gray-500 outline-none focus:border-accent"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">
                        Un-imported: <strong className="text-white font-mono">{streamtapeVideos.length}</strong>
                      </span>
                      <button
                        onClick={handleFetchStreamtape}
                        disabled={fetchingStreamtape}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/25 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <DownloadCloud className={`w-4 h-4 ${fetchingStreamtape ? 'animate-bounce' : ''}`} />
                        <span>{fetchingStreamtape ? 'Fetching from Cloud...' : 'Fetch Streamtape'}</span>
                      </button>
                    </div>
                  </div>

                  {filteredStreamtape.length === 0 ? (
                    <div className="bg-[#12131a]/80 border border-white/10 rounded-2xl p-12 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto border border-blue-500/20">
                        <DownloadCloud className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-white">Streamtape Cloud On-Demand</h4>
                      <p className="text-xs text-gray-400 max-w-md mx-auto">
                        Click <strong>"Fetch Streamtape"</strong> above to load new un-imported videos from your Streamtape account. Otherwise, it stays inactive to keep performance blazing fast.
                      </p>
                      <button
                        onClick={handleFetchStreamtape}
                        disabled={fetchingStreamtape}
                        className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-accent/25"
                      >
                        {fetchingStreamtape ? 'Connecting...' : 'Fetch Streamtape Now'}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filteredStreamtape.map(v => {
                        const isSelected = selectedStreamtape.includes(v.videoId);
                        const loadingThis = actionLoading[`st_${v.videoId}`];

                        return (
                          <div 
                            key={v.videoId} 
                            className={`bg-[#12131a]/80 border rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all ${
                              isSelected ? 'border-accent shadow-lg shadow-accent/20' : 'border-white/10 hover:border-white/20'
                            }`}
                          >
                            <div className="space-y-2.5">
                              <div className="relative aspect-video rounded-xl overflow-hidden bg-black/40 border border-white/5">
                                <img 
                                  src={v.thumbnail} 
                                  alt={v.title}
                                  className="w-full h-full object-cover"
                                  onError={e => { e.currentTarget.src = 'https://xonstream.qzz.io/siteicon.ico'; }}
                                />
                                <button
                                  onClick={() => {
                                    if (isSelected) setSelectedStreamtape(prev => prev.filter(id => id !== v.videoId));
                                    else setSelectedStreamtape(prev => [...prev, v.videoId]);
                                  }}
                                  className="absolute top-2 left-2 p-1 rounded-lg bg-black/60 backdrop-blur-md text-white hover:scale-110 transition-transform"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-accent" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </button>
                              </div>

                              <div>
                                <h4 className="text-xs font-bold text-white line-clamp-2">{v.title}</h4>
                                <p className="text-[10px] text-gray-400 font-mono mt-1">ID: {v.videoId}</p>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                              <span className="text-[10px] text-gray-500">
                                {(v.size / (1024 * 1024)).toFixed(1)} MB
                              </span>
                              <button
                                onClick={() => handleImportStreamtapeSingle(v)}
                                disabled={loadingThis}
                                className="px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent text-accent hover:text-white border border-accent/30 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
                              >
                                {loadingThis ? (
                                  <Loader size="small" />
                                ) : (
                                  <>
                                    <DownloadCloud className="w-3.5 h-3.5" />
                                    <span>Import</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────────
              TAB 3: CHANNELS MANAGEMENT
          ────────────────────────────────────────────────────────────────── */}
          {tab === 'channels' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#12131a]/80 border border-white/10 p-4 rounded-2xl">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={channelSearch}
                    onChange={e => setChannelSearch(e.target.value)}
                    placeholder="Search channels..."
                    className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder:text-gray-500 outline-none focus:border-accent"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setForm({ bulkNames: '' }); setModal({ type: 'bulk-channel', mode: 'add' }); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 rounded-xl text-xs font-semibold transition-all"
                  >
                    <FolderPlus className="w-4 h-4 text-accent" />
                    <span>Bulk Add</span>
                  </button>
                  <button
                    onClick={handleOpenAddChannel}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl text-xs font-semibold shadow-lg shadow-accent/25 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Channel</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredChannels.map(ch => {
                  const isSelected = selectedChannels.includes(ch.id);
                  const channelPostsCount = posts.filter(p => p.channelName === ch.name).length;

                  return (
                    <div 
                      key={ch.id}
                      className={`bg-[#12131a]/80 border rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all ${
                        isSelected ? 'border-accent shadow-lg shadow-accent/20' : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                if (isSelected) setSelectedChannels(prev => prev.filter(id => id !== ch.id));
                                else setSelectedChannels(prev => [...prev, ch.id]);
                              }}
                              className="text-gray-400 hover:text-white"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-accent" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>

                            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center font-bold text-lg text-accent">
                              {ch.logo ? (
                                <img src={ch.logo} alt={ch.name} className="w-full h-full object-cover" />
                              ) : (
                                ch.name[0]
                              )}
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                                {ch.name}
                                {ch.verified && <ShieldCheck className="w-3.5 h-3.5 text-accent" />}
                              </h3>
                              <p className="text-[11px] text-gray-400">@{ch.handle || ch.name.toLowerCase().replace(/\s+/g, '')}</p>
                            </div>
                          </div>
                        </div>

                        {ch.description && (
                          <p className="text-xs text-gray-400 line-clamp-2">{ch.description}</p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-md bg-white/5 text-[11px] text-gray-300 font-mono">
                          {channelPostsCount} video(s)
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditChannel(ch)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteChannel(ch.id, ch.name)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────────
              TAB 4: ACTORS MANAGEMENT (WITH INTERACTIVE CROP FOCUS TOOL)
          ────────────────────────────────────────────────────────────────── */}
          {tab === 'actors' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#12131a]/80 border border-white/10 p-4 rounded-2xl">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={actorSearch}
                    onChange={e => setActorSearch(e.target.value)}
                    placeholder="Search actors..."
                    className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder:text-gray-500 outline-none focus:border-accent"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setForm({ bulkNames: '' }); setModal({ type: 'bulk-actor', mode: 'add' }); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 rounded-xl text-xs font-semibold transition-all"
                  >
                    <FolderPlus className="w-4 h-4 text-accent" />
                    <span>Bulk Add</span>
                  </button>
                  <button
                    onClick={handleOpenAddActor}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl text-xs font-semibold shadow-lg shadow-accent/25 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Actor</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {filteredActors.map(actor => {
                  const isSelected = selectedActors.includes(actor.id);
                  const actorPostsCount = posts.filter(p => (p.actors || []).includes(actor.name)).length;

                  return (
                    <div 
                      key={actor.id}
                      className={`bg-[#12131a]/80 border rounded-2xl p-4 flex flex-col items-center text-center justify-between space-y-3 transition-all relative ${
                        isSelected ? 'border-accent shadow-lg shadow-accent/20' : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <button
                        onClick={() => {
                          if (isSelected) setSelectedActors(prev => prev.filter(id => id !== actor.id));
                          else setSelectedActors(prev => [...prev, actor.id]);
                        }}
                        className="absolute top-3 left-3 text-gray-400 hover:text-white"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-accent" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      <div className="w-20 h-20 rounded-full bg-white/5 border-2 border-white/10 overflow-hidden mt-2 relative">
                        {actor.image ? (
                          <div 
                            className="w-full h-full"
                            style={{
                              backgroundImage: `url(${actor.image})`,
                              backgroundSize: `${Math.round((actor.cropZoom ?? 1) * 100)}%`,
                              backgroundPosition: `${actor.cropX ?? 50}% ${actor.cropY ?? 50}%`,
                              backgroundRepeat: 'no-repeat',
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-xl text-accent">
                            {actor.name[0]}
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-white truncate max-w-[130px]">{actor.name}</h4>
                        <p className="text-[10px] text-gray-500 font-mono mt-0.5">{actorPostsCount} videos</p>
                      </div>

                      <div className="w-full pt-2 border-t border-white/5 flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditActor(actor)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteActor(actor.id, actor.name)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────────
              TAB 5: CATEGORIES MANAGEMENT
          ────────────────────────────────────────────────────────────────── */}
          {tab === 'categories' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#12131a]/80 border border-white/10 p-4 rounded-2xl">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={e => setCategorySearch(e.target.value)}
                    placeholder="Search categories..."
                    className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder:text-gray-500 outline-none focus:border-accent"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setForm({ bulkNames: '' }); setModal({ type: 'bulk-category', mode: 'add' }); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 rounded-xl text-xs font-semibold transition-all"
                  >
                    <FolderPlus className="w-4 h-4 text-accent" />
                    <span>Bulk Add</span>
                  </button>
                  <button
                    onClick={handleOpenAddCategory}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl text-xs font-semibold shadow-lg shadow-accent/25 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Category</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredCategories.map(cat => {
                  const isSelected = selectedCategories.includes(cat.id);
                  const catPostsCount = posts.filter(p => (p.categories || []).includes(cat.name) || p.category === cat.name).length;

                  return (
                    <div
                      key={cat.id}
                      className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isSelected 
                          ? 'bg-accent/15 border-accent shadow-lg shadow-accent/20' 
                          : 'bg-[#12131a]/80 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          onClick={() => {
                            if (isSelected) setSelectedCategories(prev => prev.filter(id => id !== cat.id));
                            else setSelectedCategories(prev => [...prev, cat.id]);
                          }}
                          className="text-gray-400 hover:text-white"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-accent" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate">{cat.name}</h4>
                          <span className="text-[10px] text-gray-400 font-mono">{catPostsCount} posts</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditCategory(cat)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────────
              TAB 6: PLAYER SETTINGS
          ────────────────────────────────────────────────────────────────── */}
          {tab === 'player-settings' && (
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
              <div className="bg-[#12131a]/90 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white">Player & Streaming Settings</h3>
                  <p className="text-xs text-gray-400 mt-1">Configure playback behaviors and primary streaming servers across the platform.</p>
                </div>

                {/* Auto Play Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div>
                    <label className="text-xs font-bold text-white block">Auto-Play Videos</label>
                    <p className="text-[11px] text-gray-400 mt-0.5">Automatically begin video streaming when users open watch pages.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPlayerSettings(prev => ({ ...prev, autoPlay: !prev.autoPlay }))}
                    className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                      playerSettings.autoPlay ? 'bg-accent shadow-md shadow-accent/30' : 'bg-white/10'
                    }`}
                  >
                    <span 
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        playerSettings.autoPlay ? 'translate-x-6' : 'translate-x-0'
                      }`} 
                    />
                  </button>
                </div>

                {/* Default Server */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white block uppercase tracking-wider">Default Streaming Server</label>
                  <p className="text-[11px] text-gray-400">Select which server takes top priority for viewers.</p>
                  
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setPlayerSettings(prev => ({ ...prev, defaultServer: 'SERVER_01' }))}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        playerSettings.defaultServer === 'SERVER_01'
                          ? 'bg-accent/15 border-accent text-white shadow-lg shadow-accent/20'
                          : 'bg-white/[0.02] border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      <span className="text-xs font-bold block text-white">SERVER 01</span>
                      <span className="text-[11px] text-accent font-medium mt-0.5 block">Streamtape (Primary)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPlayerSettings(prev => ({ ...prev, defaultServer: 'SERVER_02' }))}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        playerSettings.defaultServer === 'SERVER_02'
                          ? 'bg-accent/15 border-accent text-white shadow-lg shadow-accent/20'
                          : 'bg-white/[0.02] border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      <span className="text-xs font-bold block text-white">SERVER 02</span>
                      <span className="text-[11px] text-purple-400 font-medium mt-0.5 block">Secondary Stream</span>
                    </button>
                  </div>
                </div>

                {playerSettings.updatedAt && (
                  <p className="text-[11px] text-gray-500 font-mono">
                    Last modified: {new Date(playerSettings.updatedAt).toLocaleString()}
                  </p>
                )}

                <button
                  onClick={handleSavePlayerSettings}
                  disabled={actionLoading.savePlayer}
                  className="w-full py-3 bg-accent hover:bg-accent/90 text-white font-bold rounded-xl text-xs shadow-xl shadow-accent/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionLoading.savePlayer ? <Loader size="small" /> : 'Save Player Settings'}
                </button>
              </div>

              {/* Database Health & Maintenance Card */}
              <div className="bg-[#12131a]/80 border border-emerald-500/30 rounded-2xl p-6 space-y-5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        Database Health & Maintenance
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded-md border border-emerald-500/30">
                          Fast & Verified
                        </span>
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Clean video titles, strip file extensions, verify Streamtape thumbnails, and optimize database indexing.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Total Posts in DB</span>
                    <span className="text-base font-bold text-white font-mono">{posts.length}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">CDN Thumbnails</span>
                    <span className="text-base font-bold text-emerald-400 font-mono">100% Active</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Database Status</span>
                    <span className="text-base font-bold text-accent font-mono">Healthy</span>
                  </div>
                </div>

                {optimizationResult && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2 animate-in fade-in">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Maintenance Succeeded:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-gray-300 font-mono">
                      <div>Scanned: <strong className="text-white">{optimizationResult.totalPostsScanned}</strong></div>
                      <div>Updated: <strong className="text-emerald-300">{optimizationResult.totalPostsCompacted}</strong></div>
                      <div>Thumbs Restored: <strong className="text-white">{optimizationResult.thumbsCompacted}</strong></div>
                      <div>Status: <strong className="text-emerald-400">{optimizationResult.estimatedSpaceSaved}</strong></div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleOptimizeDatabase}
                  disabled={optimizingDB}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
                >
                  {optimizingDB ? (
                    <Loader size="small" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Run Database Maintenance & Verify Thumbnails</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ── Floating Bulk Actions Bar ───────────────────────────────────────── */}
      {(selectedPosts.length > 0 || selectedChannels.length > 0 || selectedActors.length > 0 || selectedCategories.length > 0 || selectedStreamtape.length > 0) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#12131a]/95 border border-accent/40 rounded-2xl px-5 py-3 shadow-2xl shadow-purple-950/80 backdrop-blur-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5 duration-200">
          
          {/* Post Bulk Actions */}
          {tab === 'posts' && postSubTab === 'all' && selectedPosts.length > 0 && (
            <>
              <span className="text-xs font-bold text-white font-mono bg-accent/20 px-2.5 py-1 rounded-lg border border-accent/30">
                {selectedPosts.length} selected
              </span>
              <button
                onClick={() => {
                  setForm({ bulkChannelId: '' });
                  setFormCategories([]);
                  setModal({ type: 'bulk-post-assign', mode: 'edit' });
                }}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5 text-accent" />
                <span>Bulk Assign</span>
              </button>
              <button
                onClick={handleBulkDeletePosts}
                disabled={actionLoading.bulkDeletePosts}
                className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading.bulkDeletePosts ? <Loader size="small" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete ({selectedPosts.length})</span>
              </button>
              <button 
                onClick={() => setSelectedPosts([])}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
                title="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Streamtape Bulk Actions */}
          {tab === 'posts' && postSubTab === 'streamtape' && selectedStreamtape.length > 0 && (
            <>
              <span className="text-xs font-bold text-white font-mono bg-blue-500/20 px-2.5 py-1 rounded-lg border border-blue-500/30">
                {selectedStreamtape.length} selected
              </span>
              <button
                onClick={() => {
                  setForm({ bulkStreamtapeChannelId: channels[0]?.id || '' });
                  setFormCategories([]);
                  setModal({ type: 'bulk-streamtape', mode: 'add' });
                }}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>Import Selected</span>
              </button>
              <button 
                onClick={() => setSelectedStreamtape([])}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
                title="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Channel Bulk Actions */}
          {tab === 'channels' && selectedChannels.length > 0 && (
            <>
              <span className="text-xs font-bold text-white font-mono bg-accent/20 px-2.5 py-1 rounded-lg border border-accent/30">
                {selectedChannels.length} selected
              </span>
              <button
                onClick={handleBulkDeleteChannels}
                disabled={actionLoading.bulkDeleteChannels}
                className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading.bulkDeleteChannels ? <Loader size="small" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete Selected</span>
              </button>
              <button 
                onClick={() => setSelectedChannels([])}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
                title="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Actor Bulk Actions */}
          {tab === 'actors' && selectedActors.length > 0 && (
            <>
              <span className="text-xs font-bold text-white font-mono bg-accent/20 px-2.5 py-1 rounded-lg border border-accent/30">
                {selectedActors.length} selected
              </span>
              <button
                onClick={handleBulkDeleteActors}
                disabled={actionLoading.bulkDeleteActors}
                className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading.bulkDeleteActors ? <Loader size="small" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete Selected</span>
              </button>
              <button 
                onClick={() => setSelectedActors([])}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
                title="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Category Bulk Actions */}
          {tab === 'categories' && selectedCategories.length > 0 && (
            <>
              <span className="text-xs font-bold text-white font-mono bg-accent/20 px-2.5 py-1 rounded-lg border border-accent/30">
                {selectedCategories.length} selected
              </span>
              <button
                onClick={handleBulkDeleteCategories}
                disabled={actionLoading.bulkDeleteCategories}
                className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading.bulkDeleteCategories ? <Loader size="small" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete Selected</span>
              </button>
              <button 
                onClick={() => setSelectedCategories([])}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
                title="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}

        </div>
      )}

      {/* ── MODALS ────────────────────────────────────────────────────────── */}

      {/* Modal 1: Add / Edit Post */}
      <Modal
        open={modal?.type === 'post'}
        onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Edit Video Post' : 'Create New Video Post'}
        subtitle="Changes are synced directly with Supabase"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <Field
            label="Video Title"
            value={form.title || ''}
            onChange={v => setForm({ ...form, title: v })}
            placeholder="e.g. Action Blockbuster 2026"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Streamtape Video ID"
              value={form.videoId || ''}
              onChange={v => setForm({ ...form, videoId: v })}
              placeholder="e.g. xY78AbC9..."
              hint="Streamtape video/embed link ID"
            />

            <SearchSelect
              label="Channel"
              value={form.channelName || ''}
              onChange={name => {
                const ch = channels.find(c => c.name === name);
                setForm({ ...form, channelName: name, channelId: ch?.id || '' });
              }}
              options={channels.map(c => c.name)}
              placeholder="Select channel..."
            />
          </div>

          <Field
            label="Thumbnail URL (Optional)"
            value={form.thumbnail || ''}
            onChange={v => setForm({ ...form, thumbnail: v })}
            placeholder="https://..."
            hint="Leave empty to use automatic Streamtape thumbnail"
          />

          <CategorySearchPicker
            label="Categories"
            options={categories.map(c => ({ id: c.id, name: c.name }))}
            selected={formCategories}
            onChange={setFormCategories}
          />

          <ActorSearchPicker
            label="Actors"
            existingActors={actors}
            selectedActors={formActors}
            onChange={setFormActors}
          />

          {/* Description Section with AI Generator Trigger */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">Description</label>
              <button
                type="button"
                onClick={handleGenerateDescription}
                disabled={isGeneratingDesc || !form.title?.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600/30 to-pink-600/30 hover:from-purple-600 hover:to-pink-600 text-purple-200 hover:text-white border border-purple-500/30 text-xs font-bold shadow-md shadow-purple-500/10 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {isGeneratingDesc ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-300" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-pink-400 group-hover:scale-110 transition-transform" />
                )}
                <span>Generate Description</span>
              </button>
            </div>

            {/* AI Generated 4 Options Panel */}
            {descOptions && (
              <div className="p-3.5 bg-gradient-to-b from-purple-950/40 to-black/60 border border-purple-500/30 rounded-2xl space-y-3 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Wand2 className="w-3.5 h-3.5 text-pink-400" /> 4 AI Description Options
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateDescription}
                      disabled={isGeneratingDesc}
                      className="text-[11px] text-purple-300 hover:text-white flex items-center gap-1 hover:underline"
                      title="Generate new wording variations"
                    >
                      <RefreshCw className={`w-3 h-3 ${isGeneratingDesc ? 'animate-spin' : ''}`} />
                      <span>Regenerate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDescOptions(null)}
                      className="text-gray-400 hover:text-white p-0.5 rounded-lg"
                      title="Close options"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {descOptions.map((opt) => (
                    <div
                      key={opt.id}
                      className="p-3 bg-black/40 hover:bg-purple-900/20 border border-white/10 hover:border-purple-500/40 rounded-xl transition-all space-y-2 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{opt.icon}</span>
                          <span className="text-xs font-bold text-white">{opt.label}</span>
                          <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-semibold border border-purple-500/30">
                            {opt.badge}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono">{opt.wordCount} words</span>
                      </div>

                      <p className="text-xs text-gray-300 leading-relaxed group-hover:text-white transition-colors">
                        {opt.text}
                      </p>

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => handleApplyDescription(opt.text)}
                          className="px-3 py-1.5 rounded-lg bg-pink-600/30 hover:bg-pink-600 text-pink-200 hover:text-white text-xs font-semibold border border-pink-500/30 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                        >
                          <Check className="w-3 h-3" />
                          <span>Apply This Description</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <textarea
              value={form.description || ''}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Write details about the video or tap 'Generate Description' above..."
              rows={3}
              className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all placeholder:text-gray-500 resize-none"
            />
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              onClick={() => setModal(null)}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSavePost}
              disabled={actionLoading.savePost}
              className="px-6 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-semibold shadow-lg shadow-accent/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {actionLoading.savePost ? <Loader size="small" /> : 'Save Post'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 2: Bulk Assign Posts */}
      <Modal
        open={modal?.type === 'bulk-post-assign'}
        onClose={() => setModal(null)}
        title={`Bulk Update ${selectedPosts.length} Selected Posts`}
        subtitle="Batch update channel and categories in Supabase"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">Assign Channel (Optional)</label>
            <select
              value={form.bulkChannelId || ''}
              onChange={e => setForm({ ...form, bulkChannelId: e.target.value })}
              className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-accent"
            >
              <option value="">-- Leave channel unchanged --</option>
              {channels.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <MultiSelectChips
            label="Assign Categories (Optional)"
            options={categories.map(c => ({ id: c.id, name: c.name }))}
            selected={formCategories}
            onChange={setFormCategories}
          />

          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              onClick={() => setModal(null)}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkAssignPosts}
              disabled={actionLoading.bulkAssign}
              className="px-6 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-semibold shadow-lg shadow-accent/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {actionLoading.bulkAssign ? <Loader size="small" /> : 'Apply to All Selected'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 3: Bulk Streamtape Import */}
      <Modal
        open={modal?.type === 'bulk-streamtape'}
        onClose={() => setModal(null)}
        title={`Import ${selectedStreamtape.length} Cloud Videos`}
        subtitle="Configure default channel and categories for imported items"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">Assign to Channel</label>
            <select
              value={form.bulkStreamtapeChannelId || ''}
              onChange={e => setForm({ ...form, bulkStreamtapeChannelId: e.target.value })}
              className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-accent"
            >
              {channels.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <MultiSelectChips
            label="Tag with Categories"
            options={categories.map(c => ({ id: c.id, name: c.name }))}
            selected={formCategories}
            onChange={setFormCategories}
          />

          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              onClick={() => setModal(null)}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkImportStreamtape}
              disabled={actionLoading.bulkStreamtape}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {actionLoading.bulkStreamtape ? <Loader size="small" /> : 'Start Batch Import'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 4: Channel Add / Edit */}
      <Modal
        open={modal?.type === 'channel'}
        onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Edit Channel' : 'Create Channel'}
        subtitle="Manage creator channel profile and branding"
      >
        <div className="space-y-4">
          <Field
            label="Channel Name"
            value={form.name || ''}
            onChange={v => setForm({ ...form, name: v })}
            placeholder="e.g. Neon Studios"
          />

          <Field
            label="Handle"
            value={form.handle || ''}
            onChange={v => setForm({ ...form, handle: v })}
            placeholder="neonstudios"
            hint="Unique handle used for URL routing"
          />

          <Field
            label="Logo Image URL"
            value={form.logo || ''}
            onChange={v => setForm({ ...form, logo: v })}
            placeholder="https://..."
          />

          <Field
            label="Banner Image URL"
            value={form.banner || ''}
            onChange={v => setForm({ ...form, banner: v })}
            placeholder="https://..."
          />

          <TextAreaField
            label="Description"
            value={form.description || ''}
            onChange={v => setForm({ ...form, description: v })}
            placeholder="About this channel..."
            rows={2}
          />

          <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/10">
            <span className="text-xs font-semibold text-gray-300">Verified Badge</span>
            <input
              type="checkbox"
              checked={form.verified ?? true}
              onChange={e => setForm({ ...form, verified: e.target.checked })}
              className="w-4 h-4 accent-accent rounded"
            />
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              onClick={() => setModal(null)}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveChannel}
              disabled={actionLoading.saveChannel}
              className="px-6 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-semibold shadow-lg shadow-accent/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {actionLoading.saveChannel ? <Loader size="small" /> : 'Save Channel'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 5: Actor Add / Edit (WITH INTERACTIVE CROP FOCUS TOOL) */}
      <Modal
        open={modal?.type === 'actor'}
        onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Edit Actor Profile' : 'Add New Actor'}
        subtitle="Visual focal crop tool ensures avatars look perfect everywhere"
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <Field
            label="Actor Name"
            value={form.name || ''}
            onChange={v => setForm({ ...form, name: v })}
            placeholder="e.g. Jessica Alba"
          />

          <Field
            label="Image URL"
            value={form.image || ''}
            onChange={v => setForm({ ...form, image: v })}
            placeholder="https://..."
          />

          {/* Interactive Visual Focal Crop Tool */}
          {form.image && (
            <div className="p-4 bg-black/50 border border-white/10 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-accent" /> Visual Focal Crop Preview
                </span>
                <span className="text-[11px] text-accent font-mono font-semibold">
                  Zoom: {cropZoom.toFixed(1)}x
                </span>
              </div>

              {/* Circle live preview */}
              <div className="flex justify-center">
                <div className="w-28 h-28 rounded-full border-4 border-accent/40 shadow-xl shadow-accent/20 overflow-hidden bg-white/5 relative">
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundImage: `url(${form.image})`,
                      backgroundSize: `${Math.round(cropZoom * 100)}%`,
                      backgroundPosition: `${cropX}% ${cropY}%`,
                      backgroundRepeat: 'no-repeat',
                    }}
                  />
                </div>
              </div>

              {/* Sliders */}
              <div className="space-y-3 pt-2 border-t border-white/5">
                <div>
                  <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                    <span>Horizontal Focus (X)</span>
                    <span className="font-mono">{cropX}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={cropX}
                    onChange={e => setCropX(Number(e.target.value))}
                    className="w-full accent-accent"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                    <span>Vertical Focus (Y)</span>
                    <span className="font-mono">{cropY}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={cropY}
                    onChange={e => setCropY(Number(e.target.value))}
                    className="w-full accent-accent"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                    <span>Zoom Multiplier</span>
                    <span className="font-mono">{cropZoom.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={cropZoom}
                    onChange={e => setCropZoom(Number(e.target.value))}
                    className="w-full accent-accent"
                  />
                </div>
              </div>
            </div>
          )}

          <TextAreaField
            label="Bio (Optional)"
            value={form.bio || ''}
            onChange={v => setForm({ ...form, bio: v })}
            placeholder="Short bio or actor information..."
            rows={2}
          />

          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              onClick={() => setModal(null)}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveActor}
              disabled={actionLoading.saveActor}
              className="px-6 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-semibold shadow-lg shadow-accent/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {actionLoading.saveActor ? <Loader size="small" /> : 'Save Actor'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 6: Category Add / Edit */}
      <Modal
        open={modal?.type === 'category'}
        onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Edit Category' : 'Create Category'}
        subtitle="Manage video tags and genres"
      >
        <div className="space-y-4">
          <Field
            label="Category Name"
            value={form.name || ''}
            onChange={v => setForm({ ...form, name: v })}
            placeholder="e.g. Action, Cyberpunk, Comedy"
          />

          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              onClick={() => setModal(null)}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCategory}
              disabled={actionLoading.saveCategory}
              className="px-6 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-semibold shadow-lg shadow-accent/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {actionLoading.saveCategory ? <Loader size="small" /> : 'Save Category'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 7: Bulk Create Categories */}
      <Modal
        open={modal?.type === 'bulk-category'}
        onClose={() => setModal(null)}
        title="Bulk Add Categories"
        subtitle="Paste multiple category names separated by commas or line breaks"
      >
        <div className="space-y-4">
          <TextAreaField
            label="Category Names"
            value={form.bulkNames || ''}
            onChange={v => setForm({ ...form, bulkNames: v })}
            placeholder={"Action, Adventure, Comedy\nDrama, Horror, Sci-Fi\nRomance, Thriller"}
            rows={5}
            hint="Separate each category with a comma or new line"
          />

          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              onClick={() => setModal(null)}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkCreateCategories}
              disabled={actionLoading.bulkCreateCategories}
              className="px-6 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-semibold shadow-lg shadow-accent/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {actionLoading.bulkCreateCategories ? <Loader size="small" /> : 'Create All Categories'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 8: Bulk Create Channels */}
      <Modal
        open={modal?.type === 'bulk-channel'}
        onClose={() => setModal(null)}
        title="Bulk Add Channels"
        subtitle="Enter multiple channels (one per line, format: Name or Name | Handle | Description)"
      >
        <div className="space-y-4">
          <TextAreaField
            label="Channels List (One per line)"
            value={form.bulkNames || ''}
            onChange={v => setForm({ ...form, bulkNames: v })}
            placeholder={"Bratty Sis | brattysis | Official Bratty Sis Channel\nSis Loves Me | sislovesme | Sis Loves Me Series\nPure Taboo | puretaboo | Pure Taboo Original"}
            rows={5}
            hint="One channel per line. Format: Name | Handle | Description"
          />

          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              onClick={() => setModal(null)}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkCreateChannels}
              disabled={actionLoading.bulkCreateChannels}
              className="px-6 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-semibold shadow-lg shadow-accent/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {actionLoading.bulkCreateChannels ? <Loader size="small" /> : 'Create All Channels'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal 9: Bulk Create Actors */}
      <Modal
        open={modal?.type === 'bulk-actor'}
        onClose={() => setModal(null)}
        title="Bulk Add Actors"
        subtitle="Enter multiple actors (one per line or comma-separated, or Name | Image URL)"
      >
        <div className="space-y-4">
          <TextAreaField
            label="Actors List"
            value={form.bulkNames || ''}
            onChange={v => setForm({ ...form, bulkNames: v })}
            placeholder={"Mia Malkova | https://...\nLana Rhoades\nRiley Reid | https://...\nAbella Danger"}
            rows={5}
            hint="One actor per line (or separated by comma). Format: Name or Name | Image URL"
          />

          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              onClick={() => setModal(null)}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkCreateActors}
              disabled={actionLoading.bulkCreateActors}
              className="px-6 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-semibold shadow-lg shadow-accent/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {actionLoading.bulkCreateActors ? <Loader size="small" /> : 'Create All Actors'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
