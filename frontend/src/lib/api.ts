import type { Post, VideoLink, VideoSource, PaginatedResponse, Channel, Actor } from './types';
import { getAdminToken } from './store';

// Backend API URL from environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Export API base
export const API_BASE = API_BASE_URL !== undefined ? API_BASE_URL : '';

// Helper for admin request headers
export function getAdminHeaders(extra: Record<string, string> = {}): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  const token = getAdminToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Admin authentication helpers
export async function adminLogin(username: string, password: string): Promise<{ success: boolean; token?: string; message?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return res.json();
  } catch (error) {
    console.error('Admin login failed');
    return { success: false, message: 'Login failed. Please check your connection.' };
  }
}

export async function adminLogout(): Promise<{ success: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: getAdminHeaders(),
    });
    return res.json();
  } catch (error) {
    console.error('Admin logout failed');
    return { success: false };
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options?.headers || {}),
        ...(getAdminToken() ? { 'Authorization': `Bearer ${getAdminToken()}` } : {})
      }
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const errorMessage = body.message || body.error || `Request failed (${res.status})`;
      throw new Error(errorMessage);
    }
    return res.json() as Promise<T>;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Unable to connect to server. Please check your internet connection.');
    }
    throw error;
  }
}

// ─── Streamtape Video Management ──────────────────────────────────────────────

export interface StreamtapeVideoItem {
  videoId: string;
  name: string;
  title: string;
  size: number;
  thumbnail: string;
  embedUrl: string;
  alreadyExists: boolean;
  existingPostId: string | null;
}

export async function fetchStreamtapeVideos(): Promise<{ success: boolean; count: number; data: StreamtapeVideoItem[]; message?: string }> {
  const res = await fetch(`${API_BASE}/api/admin/streamtape/videos`, {
    credentials: 'include',
    headers: getAdminHeaders(),
  });
  return res.json();
}

export async function createStreamtapePost(data: {
  title: string;
  videoId: string;
  thumbnail?: string;
  channelId?: string;
  channelName?: string;
  categoryIds?: string[];
  actorNames?: string[];
  description?: string;
}): Promise<{ success: boolean; data?: any; message?: string }> {
  const res = await fetch(`${API_BASE}/api/admin/streamtape/create-post`, {
    method: 'POST',
    credentials: 'include',
    headers: getAdminHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function bulkCreateStreamtapePosts(data: {
  videos: Array<{ title: string; videoId: string; thumbnail?: string; description?: string }>;
  channelId?: string;
  channelName?: string;
  categoryIds?: string[];
  actorNames?: string[];
}): Promise<{ success: boolean; createdCount: number; skippedCount: number; message?: string }> {
  const res = await fetch(`${API_BASE}/api/admin/streamtape/bulk-create`, {
    method: 'POST',
    credentials: 'include',
    headers: getAdminHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function fetchAdminPosts(): Promise<{ success: boolean; data: Post[]; message?: string }> {
  // Use dedicated admin endpoint to get all posts with full details
  const res = await fetch(`${API_BASE}/api/admin/posts`, {
    credentials: 'include',
    headers: getAdminHeaders(),
  });
  const json = await res.json();
  return json;
}

export async function fetchPosts(
  page = 1,
  perPage = 12,
  category?: string
): Promise<PaginatedResponse<Post>> {
  const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
  if (category && category !== 'all') params.set('category', category);
  return apiFetch(`/api/posts?${params}`);
}

export async function fetchPopularPosts(page = 1, perPage = 12): Promise<PaginatedResponse<Post>> {
  const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
  return apiFetch(`/api/posts/popular?${params}`);
}

export async function fetchTrendingPosts(page = 1, perPage = 12): Promise<PaginatedResponse<Post>> {
  const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
  return apiFetch(`/api/posts/trending?${params}`);
}

export async function fetchPost(id: string): Promise<{ success: boolean; data: Post }> {
  return apiFetch(`/api/posts/${id}`);
}

export async function fetchVideoLinks(
  id: string
): Promise<{ success: boolean; data: { postId: string; videoLink: VideoLink | null; sources?: VideoSource[] } }> {
  return apiFetch(`/api/posts/${id}/video`);
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface SearchParams {
  q?: string;
  actor?: string;
  channel?: string;
  category?: string;
  page?: number;
  perPage?: number;
}

export interface QuickSearchResult {
  success: boolean;
  videos: Post[];
  channels: Channel[];
  actors: Actor[];
}

export async function quickSearch(q: string): Promise<QuickSearchResult> {
  if (!q || !q.trim()) return { success: true, videos: [], channels: [], actors: [] };
  return apiFetch(`/api/search/quick?q=${encodeURIComponent(q.trim())}`);
}

export async function searchPosts(opts: SearchParams): Promise<PaginatedResponse<Post>> {
  const params = new URLSearchParams();
  if (opts.q) params.set('q', opts.q);
  if (opts.actor) params.set('actor', opts.actor);
  if (opts.channel) params.set('channel', opts.channel);
  if (opts.category) params.set('category', opts.category);
  params.set('page', String(opts.page ?? 1));
  params.set('perPage', String(opts.perPage ?? 12));
  return apiFetch(`/api/search?${params}`);
}

// ─── Channels ─────────────────────────────────────────────────────────────────

export async function fetchChannels(): Promise<{ success: boolean; data: Channel[] }> {
  return apiFetch('/api/channels');
}

export async function saveChannel(ch: Channel): Promise<{ success: boolean; data?: Channel; message?: string }> {
  const isEdit = ch.id && !ch.id.startsWith('ch-');
  const url = isEdit ? `${API_BASE}/api/admin/channels/${ch.id}` : `${API_BASE}/api/admin/channels`;
  const method = isEdit ? 'PUT' : 'POST';
  
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: getAdminHeaders(),
    body: JSON.stringify(ch),
  });
  return res.json();
}

export async function deleteChannel(id: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/admin/channels/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: getAdminHeaders(),
  });
  return res.json();
}

export async function fetchChannelPosts(
  channelId: string,
  page = 1,
  perPage = 12
): Promise<{ success: boolean; data: { channel: Channel; posts: Post[]; pagination: any } }> {
  const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
  return apiFetch(`/api/channels/${channelId}?${params}`);
}

// ─── Actors ───────────────────────────────────────────────────────────────────

export async function fetchActors(): Promise<{ success: boolean; data: Actor[] }> {
  return apiFetch('/api/actors');
}

export async function fetchActorById(
  id: string,
  page = 1,
  perPage = 12
): Promise<{ success: boolean; data: { actor: Actor; posts: Post[]; pagination: any } }> {
  const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
  return apiFetch(`/api/actors/${id}?${params}`);
}

export async function saveActor(actor: Actor): Promise<{ success: boolean; data?: Actor; message?: string }> {
  const isEdit = actor.id && !actor.id.startsWith('actor-');
  const url = isEdit ? `${API_BASE}/api/admin/actors/${actor.id}` : `${API_BASE}/api/admin/actors`;
  const method = isEdit ? 'PUT' : 'POST';
  
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: getAdminHeaders(),
    body: JSON.stringify(actor),
  });
  return res.json();
}

export async function deleteActor(id: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/admin/actors/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: getAdminHeaders(),
  });
  return res.json();
}

// ─── Player Settings ──────────────────────────────────────────────────────────

export interface PlayerSettings {
  autoPlay: boolean;
  defaultServer: 'SERVER_01' | 'SERVER_02';
  updatedAt: string;
}

export async function fetchPlayerSettings(): Promise<{ success: boolean; data: PlayerSettings }> {
  return apiFetch('/api/public/settings/player');
}

export async function fetchAdminPlayerSettings(): Promise<{ success: boolean; data: PlayerSettings }> {
  return apiFetch(`/api/admin/settings/player`, { 
    credentials: 'include',
    headers: getAdminHeaders(),
  });
}

export async function updatePlayerSettings(settings: Partial<PlayerSettings>): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/admin/settings/player`, {
    method: 'PUT',
    credentials: 'include',
    headers: getAdminHeaders(),
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }
  return res.json();
}

// ─── Categories ───────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  icon?: string;
}

export async function fetchCategories(): Promise<{ success: boolean; data: Category[] }> {
  return apiFetch('/api/categories');
}

export async function saveCategory(category: Category): Promise<{ success: boolean; data?: Category; message?: string }> {
  const isEdit = category.id && !category.id.startsWith('cat-');
  const url = isEdit ? `${API_BASE}/api/admin/categories/${category.id}` : `${API_BASE}/api/admin/categories`;
  const method = isEdit ? 'PUT' : 'POST';
  
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: getAdminHeaders(),
    body: JSON.stringify(category),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }
  return res.json();
}

export async function deleteCategory(id: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/admin/categories/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: getAdminHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }
  return res.json();
}

// ─── Bulk Operations ─────────────────────────────────────────────────────────

export async function bulkDeletePosts(postIds: string[]): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/admin/posts/bulk-delete`, {
    method: 'POST',
    credentials: 'include',
    headers: getAdminHeaders(),
    body: JSON.stringify({ postIds }),
  });
  return res.json();
}

export async function bulkEditPosts(data: {
  postIds: string[];
  setChannel?: string;
  setCategories?: string[];
  addActors?: string[];
  removeActors?: string[];
}): Promise<{ success: boolean; data?: any; message?: string }> {
  const res = await fetch(`${API_BASE}/api/admin/posts/bulk-edit`, {
    method: 'POST',
    credentials: 'include',
    headers: getAdminHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function bulkDeleteChannels(channelIds: string[]): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/admin/channels/bulk-delete`, {
    method: 'POST',
    credentials: 'include',
    headers: getAdminHeaders(),
    body: JSON.stringify({ channelIds }),
  });
  return res.json();
}

export async function bulkDeleteActors(actorIds: string[]): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/admin/actors/bulk-delete`, {
    method: 'POST',
    credentials: 'include',
    headers: getAdminHeaders(),
    body: JSON.stringify({ actorIds }),
  });
  return res.json();
}

export async function bulkDeleteCategories(categoryIds: string[]): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/admin/categories/bulk-delete`, {
    method: 'POST',
    credentials: 'include',
    headers: getAdminHeaders(),
    body: JSON.stringify({ categoryIds }),
  });
  return res.json();
}

export async function bulkCreateCategories(names: string[]): Promise<{ success: boolean; count?: number; data?: Category[]; message?: string }> {
  const res = await fetch(`${API_BASE}/api/admin/categories/bulk-create`, {
    method: 'POST',
    credentials: 'include',
    headers: getAdminHeaders(),
    body: JSON.stringify({ names }),
  });
  return res.json();
}

export async function bulkCreateChannels(data: { names?: string[]; items?: Partial<Channel>[] }): Promise<{ success: boolean; count?: number; data?: Channel[]; message?: string }> {
  const res = await fetch(`${API_BASE}/api/admin/channels/bulk-create`, {
    method: 'POST',
    credentials: 'include',
    headers: getAdminHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function bulkCreateActors(data: { names?: string[]; items?: Partial<Actor>[] }): Promise<{ success: boolean; count?: number; data?: Actor[]; message?: string }> {
  const res = await fetch(`${API_BASE}/api/admin/actors/bulk-create`, {
    method: 'POST',
    credentials: 'include',
    headers: getAdminHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function savePost(post: Partial<Post> & { id?: string; channelId?: string; categoryIds?: string[]; actorNames?: string[]; videoId?: string }): Promise<{ success: boolean; data?: Post; message?: string }> {
  const isEdit = !!post.id;
  const url = isEdit ? `${API_BASE}/api/admin/posts/${post.id}` : `${API_BASE}/api/admin/posts`;
  const method = isEdit ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: getAdminHeaders(),
    body: JSON.stringify(post),
  });
  return res.json();
}

export async function deletePost(id: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/admin/posts/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: getAdminHeaders(),
  });
  return res.json();
}

export async function optimizeDatabaseStorage(): Promise<{
  success: boolean;
  message?: string;
  stats?: {
    totalPostsScanned: number;
    totalPostsCompacted: number;
    thumbsCompacted: number;
    descsCompacted: number;
    titlesCleaned: number;
    estimatedSpaceSaved: string;
  };
}> {
  const res = await fetch(`${API_BASE}/api/admin/database/optimize`, {
    method: 'POST',
    credentials: 'include',
    headers: getAdminHeaders(),
  });
  return res.json();
}
