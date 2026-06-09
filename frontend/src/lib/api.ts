import type { Post, VideoLink, VideoSource, PaginatedResponse, Channel, Actor } from './types';

// Backend API URL from environment variable
// This MUST be set in .env file - no hardcoded fallbacks for security
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  console.error('VITE_API_BASE_URL is not set in environment variables');
}

// Export API base - will be undefined if env var is not set
export const API_BASE = API_BASE_URL || '';

// ─── Admin Token Helpers ───────────────────────────────────────────────────────
// Store the JWT in localStorage so it survives page reloads and can be sent as
// an Authorization: Bearer header — works cross-origin unlike SameSite cookies.
const ADMIN_TOKEN_KEY = 'xonstream_admin_token';

export function setAdminToken(token: string): void {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function clearAdminToken(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

/**
 * Returns headers that include the Authorization Bearer token when available.
 * Merge this into any admin fetch call: { headers: adminAuthHeaders() }
 */
export function adminAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAdminToken();
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Wrapper around fetch for all admin-protected endpoints.
 * Sends both the cookie (for backward compat) AND an Authorization Bearer token
 * so it works even when cross-origin cookies are blocked by the browser.
 */
async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { headers: extraHeaders, ...rest } = options;
  return fetch(url, {
    credentials: 'include',
    ...rest,
    headers: adminAuthHeaders(extraHeaders as Record<string, string> | undefined ?? {}),
  });
}

// ─── Admin Auth ───────────────────────────────────────────────────────────────

export async function adminLogin(username: string, password: string): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    // Store the JWT so all subsequent admin calls can send it as Authorization: Bearer
    if (data.success && data.token) {
      setAdminToken(data.token);
    }
    return data;
  } catch (error) {
    console.error('Admin login failed');
    return { success: false, message: 'Login failed. Please try again.' };
  }
}

export async function adminLogout(): Promise<{ success: boolean }> {
  try {
    const res = await adminFetch(`${API_BASE}/api/admin/logout`, {
      method: 'POST',
    });
    clearAdminToken();
    return res.json();
  } catch (error) {
    console.error('Admin logout failed');
    clearAdminToken();
    return { success: false };
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, options);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      // Return user-friendly error without exposing URLs or sensitive data
      const errorMessage = body.message || body.error || `Request failed (${res.status})`;
      throw new Error(errorMessage);
    }
    return res.json() as Promise<T>;
  } catch (error) {
    // If it's a network error (no response), don't expose the URL
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Unable to connect to server. Please check your internet connection.');
    }
    // Re-throw other errors (already sanitized)
    throw error;
  }
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function fetchAdminPosts(): Promise<{ success: boolean; data: Post[] }> {
  // Use dedicated admin endpoint to get all posts with full details.
  // adminFetch sends both the cookie AND Authorization: Bearer so it works cross-origin.
  const res = await adminFetch(`${API_BASE}/api/admin/posts`);
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

  const res = await adminFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ch),
  });
  return res.json();
}

export async function deleteChannel(id: string): Promise<{ success: boolean }> {
  const res = await adminFetch(`${API_BASE}/api/admin/channels/${id}`, {
    method: 'DELETE',
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

  const res = await adminFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(actor),
  });
  return res.json();
}

export async function deleteActor(id: string): Promise<{ success: boolean }> {
  const res = await adminFetch(`${API_BASE}/api/admin/actors/${id}`, {
    method: 'DELETE',
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
  const res = await adminFetch(`${API_BASE}/api/admin/settings/player`);
  return res.json();
}

export async function updatePlayerSettings(autoPlay: boolean, defaultServer: 'SERVER_01' | 'SERVER_02' = 'SERVER_01'): Promise<{ success: boolean; message: string; data: PlayerSettings }> {
  const res = await adminFetch(`${API_BASE}/api/admin/settings/player`, {
    method: 'PUT',
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

  const res = await adminFetch(url, {
    method,
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
  const res = await adminFetch(`${API_BASE}/api/admin/categories/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }
  return res.json();
}

// Admin sync and posts
export async function syncPosts(startPage?: number, endPage?: number): Promise<{ success: boolean; data?: any; message?: string }> {
  const res = await adminFetch(`${API_BASE}/api/admin/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startPage, endPage }),
  });
  return res.json();
}

export async function deleteAllPosts(): Promise<{ success: boolean; message?: string }> {
  const res = await adminFetch(`${API_BASE}/api/admin/posts/all`, {
    method: 'DELETE',
  });
  return res.json();
}

export async function deleteDuplicates(): Promise<{ success: boolean; data?: any; message?: string }> {
  const res = await adminFetch(`${API_BASE}/api/admin/posts/delete-duplicates`, {
    method: 'POST',
  });
  return res.json();
}

// ─── Support Requests ────────────────────────────────────────────────────────
export interface SupportRequest {
  key: string;
  fullName: string;
  email: string;
  description: string;
  status: string;
  createdAt: string;
}

export async function submitSupportRequest(fullName: string, email: string, description: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/public/support`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName, email, description }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.error || `API error ${res.status}`);
  }
  return res.json();
}

export async function fetchSupportRequests(): Promise<{ success: boolean; data: SupportRequest[] }> {
  const res = await adminFetch(`${API_BASE}/api/admin/support`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.error || `API error ${res.status}`);
  }
  return res.json();
}

export async function deleteSupportRequest(key: string): Promise<{ success: boolean; message?: string }> {
  const params = new URLSearchParams({ key });
  const res = await adminFetch(`${API_BASE}/api/admin/support?${params.toString()}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.error || `API error ${res.status}`);
  }
  return res.json();
}
