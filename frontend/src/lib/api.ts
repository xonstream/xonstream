import type { Post, VideoLink, VideoSource, PaginatedResponse, Channel, Actor } from './types';

export const API_BASE = '';

// Admin authentication helpers
export async function adminLogin(username: string, password: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/admin/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return res.json();
}

export async function adminLogout(): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/admin/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  return res.json();
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function fetchAdminPosts(): Promise<{ success: boolean; data: Post[] }> {
  // Use dedicated admin endpoint to get all posts with full details
  const res = await fetch(`${API_BASE}/api/admin/posts`, {
    credentials: 'include',
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

export async function saveChannel(ch: Channel): Promise<{ success: boolean }> {
  // Check if this is an existing channel (has a valid UUID-like ID)
  const isEdit = ch.id && !ch.id.startsWith('ch-');
  const url = isEdit ? `${API_BASE}/api/admin/channels/${ch.id}` : `${API_BASE}/api/admin/channels`;
  const method = isEdit ? 'PUT' : 'POST';
  
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ch),
  });
  return res.json();
}

export async function deleteChannel(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/admin/channels/${id}`, {
    method: 'DELETE',
    credentials: 'include',
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

export async function saveActor(actor: Actor): Promise<{ success: boolean }> {
  // Check if this is an existing actor (has a valid UUID-like ID)
  const isEdit = actor.id && !actor.id.startsWith('actor-');
  const url = isEdit ? `${API_BASE}/api/admin/actors/${actor.id}` : `${API_BASE}/api/admin/actors`;
  const method = isEdit ? 'PUT' : 'POST';
  
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(actor),
  });
  return res.json();
}

export async function deleteActor(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/admin/actors/${id}`, {
    method: 'DELETE',
    credentials: 'include',
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
  return apiFetch(`/api/admin/settings/player`, { credentials: 'include' });
}

export async function updatePlayerSettings(autoPlay: boolean, defaultServer: 'SERVER_01' | 'SERVER_02' = 'SERVER_01'): Promise<{ success: boolean; message: string; data: PlayerSettings }> {
  const res = await fetch(`${API_BASE}/api/admin/settings/player`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ autoPlay, defaultServer }),
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
  icon?: string; // Optional for backward compatibility
}

export async function fetchCategories(): Promise<{ success: boolean; data: Category[] }> {
  return apiFetch('/api/categories');
}

export async function saveCategory(category: Category): Promise<{ success: boolean; message?: string }> {
  // Check if this is an existing category (has a valid UUID-like ID)
  const isEdit = category.id && !category.id.startsWith('cat-');
  const url = isEdit ? `${API_BASE}/api/admin/categories/${category.id}` : `${API_BASE}/api/admin/categories`;
  const method = isEdit ? 'PUT' : 'POST';
  
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
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
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }
  return res.json();
}

// Admin sync and posts
export async function syncPosts(): Promise<{ success: boolean; data?: any; message?: string }> {
  const res = await fetch(`${API_BASE}/api/admin/sync`, {
    method: 'POST',
    credentials: 'include',
  });
  return res.json();
}

export async function deleteAllPosts(): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/admin/posts/all`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return res.json();
}
