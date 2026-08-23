export interface Video {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  videoId?: string;
  channelId: string;
  categoryIds: string[];
  description: string;
  uploadDate: string;
  views: number;
  likes: number;
}

// ─── Backend post types ───────────────────────────────────────────────────────

// For API responses (full data)
export interface VideoSource {
  platform: string;
  name: string;
  videoId: string;
  embedUrl: string;
  downloadUrl?: string;
  thumbnail?: string;
}

// For admin forms (minimal data)
export interface VideoSourceInput {
  platform: 'streamtape' | string;
  videoId: string;
}

export interface VideoLink {
  platform: string;
  videoId: string;
  embedUrl: string;
  downloadUrl?: string;
  thumbnail?: string;
}

export interface Post {
  id: string;
  title: string;
  description: string;
  actors: string[];
  channelName: string;
  channelId?: string;
  categories: string[];
  category?: string;
  thumbnail: string;
  previewUrl?: string; // Animated preview for hover (WebP)
  videoSources: VideoSource[];
  createdAt: string;
  actorCount?: number;
}

export interface Pagination {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: Pagination;
}

export interface Channel {
  id: string;
  name: string;
  handle: string;
  logo: string;
  banner: string;
  description: string;
  subscribers: number;
  totalVideos: number;
  verified: boolean;
}

export interface Actor {
  id: string;
  name: string;
  image: string;
  totalVideos: number;
  cropX?: number;    // 0-100 (horizontal focus, default 50)
  cropY?: number;    // 0-100 (vertical focus, default 50)
  cropZoom?: number; // 1.0-3.0 (zoom level, default 1)
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  favourites: string[];
  subscriptions: string[];
  history: string[];
  createdAt: string;
}

export type DeviceType = 'pc' | 'mobile' | 'tablet' | 'ios' | 'ipad';
