export interface Bindings {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  STREAMTAPE_LOGIN?: string;
  STREAMTAPE_KEY?: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SECRET?: string;
}

export interface VideoSource {
  platform: string;
  name: string;
  videoId: string;
  embedUrl: string;
  downloadUrl?: string;
  thumbnail?: string;
}

export interface FormattedPost {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelName: string;
  channelId?: string;
  categories: string[];
  category: string;
  actors: string[];
  videoSources: VideoSource[];
  createdAt: string;
  actorCount: number;
}
