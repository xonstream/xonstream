// Simple localStorage-based store for user state
const STORAGE_KEYS = {
  THEME: 'vidstream_theme',
  USER: 'vidstream_user',
  FAVOURITES: 'vidstream_favourites',
  LIKES: 'vidstream_likes',
  SUBSCRIPTIONS: 'vidstream_subscriptions',
  HISTORY: 'vidstream_history',
  REMEMBER_ME: 'vidstream_remember',
  USERS_DB: 'vidstream_users',
  VIDEOS_DB: 'vidstream_posts',
  CHANNELS_DB: 'vidstream_channels',
  ACTORS_DB: 'vidstream_actors',
  CATEGORIES_DB: 'vidstream_categories',
  SETTINGS: 'vidstream_settings',
};

// Admin authentication is handled by backend API only
// No admin credentials should be in frontend

export function getTheme(): 'dark' | 'light' {
  return (localStorage.getItem(STORAGE_KEYS.THEME) as 'dark' | 'light') || 'dark';
}

export function setTheme(theme: 'dark' | 'light') {
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
  if (theme === 'light') {
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.remove('light');
  }
}

export function initTheme() {
  const theme = getTheme();
  setTheme(theme);
}

export function getCurrentUser(): { username: string; email: string; isAdmin: boolean } | null {
  const data = localStorage.getItem(STORAGE_KEYS.USER);
  return data ? JSON.parse(data) : null;
}

export function signIn(username: string, password: string, rememberMe: boolean): { success: boolean; error?: string; isAdmin?: boolean } {
  // Normal login: never grants admin access — admin only via /meow
  const usersDb: Array<{ username: string; email: string; password: string }> = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS_DB) || '[]');
  const user = usersDb.find(u => u.username === username && u.password === password);
  if (user) {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ username: user.username, email: user.email, isAdmin: false }));
    if (rememberMe) localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'true');
    return { success: true, isAdmin: false };
  }
  return { success: false, error: 'Invalid username or password' };
}

// Admin session storage — called AFTER successful backend authentication
// Password validation happens in backend only
export function setAdminSession(): void {
  const user = { username: 'admin', email: 'admin@xonstream.com', isAdmin: true };
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
}

export function signUp(username: string, email: string, password: string): { success: boolean; error?: string } {
  const usersDb: Array<{ username: string; email: string; password: string }> = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS_DB) || '[]');
  if (usersDb.some(u => u.username === username)) return { success: false, error: 'Username already exists' };
  if (usersDb.some(u => u.email === email)) return { success: false, error: 'Email already registered' };
  usersDb.push({ username, email, password });
  localStorage.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(usersDb));
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ username, email, isAdmin: false }));
  return { success: true };
}

export function signOut() {
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME);
}

export function getFavourites(): string[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVOURITES) || '[]');
}

export function toggleFavourite(videoId: string): boolean {
  const favs = getFavourites();
  const index = favs.indexOf(videoId);
  if (index > -1) {
    favs.splice(index, 1);
    localStorage.setItem(STORAGE_KEYS.FAVOURITES, JSON.stringify(favs));
    return false;
  }
  favs.push(videoId);
  localStorage.setItem(STORAGE_KEYS.FAVOURITES, JSON.stringify(favs));
  return true;
}

export function getLikes(): string[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]');
}

export function toggleLike(videoId: string): boolean {
  const likes = getLikes();
  const index = likes.indexOf(videoId);
  if (index > -1) {
    likes.splice(index, 1);
    localStorage.setItem(STORAGE_KEYS.LIKES, JSON.stringify(likes));
    return false;
  }
  likes.push(videoId);
  localStorage.setItem(STORAGE_KEYS.LIKES, JSON.stringify(likes));
  return true;
}

export function getSubscriptions(): string[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.SUBSCRIPTIONS) || '[]');
}

export function toggleSubscription(channelId: string): boolean {
  const subs = getSubscriptions();
  const index = subs.indexOf(channelId);
  if (index > -1) {
    subs.splice(index, 1);
    localStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(subs));
    return false;
  }
  subs.push(channelId);
  localStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(subs));
  return true;
}

interface HistoryEntry {
  videoId: string;
  watchedAt: number;
}

export function getHistory(): HistoryEntry[] {
  const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    // Migration: if old format (string[]), clear it
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

export function getRecentHistory(hoursAgo = 24): HistoryEntry[] {
  const cutoff = Date.now() - hoursAgo * 60 * 60 * 1000;
  return getHistory().filter(e => e.watchedAt >= cutoff);
}

export function addToHistory(videoId: string) {
  const history = getHistory();
  const filtered = history.filter(e => e.videoId !== videoId);
  filtered.unshift({ videoId, watchedAt: Date.now() });
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(filtered.slice(0, 100)));
}

export function clearHistory() {
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify([]));
}

export function getSettings() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{"authEnabled": true, "siteName": "VidStream", "siteLogo": ""}');
}

export function saveSettings(settings: { authEnabled: boolean; siteName: string; siteLogo: string }) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

// ── Profile ──────────────────────────────────────────────────────────────────
export function getProfile(): { name: string; icon: string } {
  const raw = localStorage.getItem('vidstream_profile');
  return raw ? JSON.parse(raw) : { name: '', icon: '' };
}

export function saveProfile(profile: { name: string; icon: string }) {
  localStorage.setItem('vidstream_profile', JSON.stringify(profile));
}
