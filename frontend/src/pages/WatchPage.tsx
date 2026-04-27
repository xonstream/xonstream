import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchPost, fetchVideoLinks, fetchChannels, fetchActors, fetchPosts, fetchPlayerSettings } from '@/lib/api';
import { addToHistory, toggleFavourite, getFavourites, toggleLike, getLikes } from '@/lib/store';
import SubscribeButton from '@/components/SubscribeButton';
import PostBox from '@/components/PostBox';
import LikeIcon from '@/components/LikeIcon';
import { Share2, Plus, Star, Download, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { VideoLink, VideoSource } from '@/lib/types';
import { extractPostIdFromSlug } from '@/lib/utils';
import { logger } from '@/lib/logger';

// ── Download Modal ──────────────────────────────────────────────────────────
function DownloadModal({ open, onClose, sources }: { open: boolean; onClose: () => void; sources: VideoSource[] }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-[16px] w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-accent" />
            <h2 className="text-base font-bold text-foreground">Download Video</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {sources.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm">No download available</p>
            </div>
          ) : (
            sources.map((source) => (
              <a
                key={source.platform}
                href={source.downloadUrl || source.embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="flex items-center justify-between p-4 rounded-[12px] bg-gradient-to-r from-purple-500/20 to-purple-600/10 border border-purple-500/40 hover:border-purple-400 cursor-pointer group transition-all duration-200"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{source.name}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">{source.platform}</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/20 rounded-[20px] group-hover:bg-accent/40 transition-colors">
                  <Download className="w-3.5 h-3.5 text-accent" />
                  <span className="text-xs text-accent font-medium">Download</span>
                </div>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Channel Avatar ──────────────────────────────────────────────────────────
function ChannelAvatar({ channelName }: { channelName?: string }) {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ['channels'], queryFn: fetchChannels, staleTime: 300_000 });
  const ch = (data?.data ?? []).find(c => c.name === channelName);
  return (
    <div onClick={() => ch ? navigate(`/channel/${ch.id}`) : undefined}
      className="w-10 h-10 rounded-full bg-secondary flex-shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold text-muted-foreground uppercase cursor-pointer hover:ring-2 hover:ring-accent/40 transition-all">
      {ch?.logo ? <img src={ch.logo} alt={channelName} className="w-full h-full object-cover" /> : (channelName?.[0] ?? '?')}
    </div>
  );
}

// ── Channel Link (clickable name) ───────────────────────────────────────────
function ChannelLink({ channelName }: { channelName?: string }) {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ['channels'], queryFn: fetchChannels, staleTime: 300_000 });
  const ch = (data?.data ?? []).find(c => c.name === channelName);
  return (
    <p onClick={() => ch ? navigate(`/channel/${ch.id}`) : undefined}
      className="text-sm font-semibold text-foreground cursor-pointer hover:text-accent transition-colors">
      {channelName ?? '—'}
    </p>
  );
}

// ── Channel Subscribe ───────────────────────────────────────────────────────
function ChannelSubscribe({ channelName }: { channelName: string }) {
  const { data } = useQuery({ queryKey: ['channels'], queryFn: fetchChannels, staleTime: 300_000 });
  const ch = (data?.data ?? []).find(c => c.name === channelName);
  if (!ch) return null;
  return <SubscribeButton channelId={ch.id} />;
}

// ── Actor Circle ────────────────────────────────────────────────────────────
function ActorCircle({ actorName }: { actorName: string }) {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({ 
    queryKey: ['actors'], 
    queryFn: fetchActors, 
    staleTime: 300_000,
    retry: 2,
  });
  
  const actors = data?.data ?? [];
  const actor = actors.find(a => a.name.toLowerCase() === actorName.toLowerCase());
  
  const handleClick = () => {
    if (actor) {
      navigate(`/actor/${actor.id}`);
    } else {
      navigate(`/search?actor=${encodeURIComponent(actorName)}`);
    }
  };
  
  return (
    <div onClick={handleClick}
      className="flex flex-col items-center gap-1.5 group cursor-pointer">
      <div className="w-16 h-16 rounded-full bg-secondary overflow-hidden flex items-center justify-center text-lg font-bold text-muted-foreground uppercase group-hover:ring-2 group-hover:ring-accent/40 transition-all">
        {actor?.image ? (
          <div className="w-full h-full" style={{
            backgroundImage: `url(${actor.image})`,
            backgroundSize: `${Math.round((actor.cropZoom ?? 1) * 100)}%`,
            backgroundPosition: `${actor.cropX ?? 50}% ${actor.cropY ?? 50}%`,
            backgroundRepeat: 'no-repeat',
          }} />
        ) : (
          <span>{actorName[0]}</span>
        )}
      </div>
      <span className="text-xs text-muted-foreground group-hover:text-accent transition-colors">
        {actorName}
      </span>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function WatchPage() {
  const [params] = useSearchParams();
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  
  // Support both old query param format (?v=id) and new slug format (/video/slug-shortid)
  const directVideoId = params.get('v') || '';
  const shortIdFromSlug = slug ? extractPostIdFromSlug(slug) : '';
  
  // If we have a short ID from slug, we need to find the full post ID
  const [resolvedVideoId, setResolvedVideoId] = useState(directVideoId || shortIdFromSlug || '');
  
  // Fetch posts to resolve short ID to full ID
  useEffect(() => {
    if (shortIdFromSlug && !directVideoId) {
      // We have a short ID, need to find matching post
      fetchPosts(1, 100).then(response => {
        if (response.success) {
          const matchingPost = response.data.find((post: any) => 
            post.id.endsWith(shortIdFromSlug)
          );
          if (matchingPost) {
            setResolvedVideoId(matchingPost.id);
          } else {
            // Post not found, show error
            toast.error('Video not found');
          }
        }
      }).catch(err => {
        console.error('Failed to resolve video ID:', err);
        toast.error('Failed to load video');
      });
    }
  }, [shortIdFromSlug, directVideoId]);
  
  const videoId = resolvedVideoId;
  const [liked, setLiked] = useState(() => getLikes().includes(directVideoId || shortIdFromSlug || ''));
  const [isFav, setIsFav] = useState(() => getFavourites().includes(params.get('v') || ''));
  const [showDownload, setShowDownload] = useState(false);

  const { data: postData, isError: postError } = useQuery({
    queryKey: ['post', videoId],
    queryFn: () => fetchPost(videoId).catch((error) => {
      // Silently handle errors - don't let them propagate to console
      return { success: false, data: null, error: error.message };
    }),
    enabled: !!videoId,
    retry: 0,
    staleTime: 60_000,
  });

  const { data: videoData } = useQuery({
    queryKey: ['videoLinks', videoId],
    queryFn: () => fetchVideoLinks(videoId).catch((error) => {
      // Silently handle errors - don't let them propagate to console
      return { success: false, data: { postId: videoId, videoLink: null, sources: [] }, error: error.message };
    }),
    enabled: !!videoId,
    retry: 0,
    staleTime: 0,  // always fresh — server ordering must be correct immediately
  });

  const { data: relatedData } = useQuery({
    queryKey: ['posts', 1, 'all'],
    queryFn: () => import('@/lib/api').then(m => m.fetchPosts(1, 7)).catch(() => {
      // Return empty array on error
      return { success: true, data: [] };
    }),
    retry: 0,
    staleTime: 60_000,
  });

  // Fetch player settings for auto-play
  const { data: playerSettingsData } = useQuery({
    queryKey: ['playerSettings'],
    queryFn: () => fetchPlayerSettings().catch(() => {
      // Return default settings on error
      return { success: true, data: { autoPlay: true, updatedAt: '' } };
    }),
    retry: 0,
    staleTime: 300_000,
  });

  const post = postData?.data;
  const videoLink = videoData?.data?.videoLink ?? null;
  const sources = videoData?.data?.sources ?? [];
  const relatedPosts = (relatedData?.data ?? []).filter(p => p.id !== videoId).slice(0, 6);
  
  // Use SeekStreaming source (only source now)
  const embedUrl = sources[0]?.embedUrl ?? videoLink?.embedUrl ?? null;

  useEffect(() => {
    if (post) {
      addToHistory(post.id);
      setIsFav(getFavourites().includes(post.id));
      setLiked(getLikes().includes(post.id));
    }
  }, [post]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link Copied!');
  };

  const handleLike = () => {
    if (!videoId) return;
    const added = toggleLike(videoId);
    setLiked(added);
    toast.success(added ? 'Liked!' : 'Like Removed');
  };

  const handleFavourite = () => {
    if (!videoId) return;
    const added = toggleFavourite(videoId);
    setIsFav(added);
    toast.success(added ? 'Added to Favourites!' : 'Removed from Favourites');
  };

  return (
    <div className="px-0 sm:p-4 flex flex-col lg:flex-row gap-0 sm:gap-6">
      <DownloadModal open={showDownload} onClose={() => setShowDownload(false)} sources={sources} />

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">

        {/* Player - Full width on mobile, max 1920x1080 on desktop, responsive */}
        <div className="w-full max-w-[1920px] mx-auto bg-card sm:rounded-[12px] overflow-hidden flex items-center justify-center -mx-0 sm:mx-0" style={{ cursor: 'default', aspectRatio: '16/9' }}>
          {embedUrl ? (
            <iframe
              key={embedUrl}
              src={embedUrl}
              className="w-full h-full"
              allowFullScreen
              allow="autoplay; encrypted-media; picture-in-picture"
              style={{ cursor: 'default' }}
              title={post?.title || 'Video Player'}
            />
          ) : !postError ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
              <p className="text-sm">Loading video...</p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Video not available</p>
          )}
        </div>

        {/* Title */}
        <h1 className="text-xl font-bold text-foreground mt-4 px-4 sm:px-0">
          {post?.title ?? (postError ? `Post ID: ${videoId}` : 'Loading title…')}
        </h1>

        {/* Channel + Actions row */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-4 px-4 sm:px-0">
          <div className="flex items-center gap-3">
            <ChannelAvatar channelName={post?.channelName} />
            <div>
              <ChannelLink channelName={post?.channelName} />
            </div>
            {post?.channelName && <ChannelSubscribe channelName={post.channelName} />}
          </div>

          {/* Action buttons - mobile-optimized sizing */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={handleLike}
              className={`flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-[24px] text-sm sm:text-base font-semibold transition-all active:scale-95 ${
                liked ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-tertiary'
              }`}
              title="Like"
            >
              <LikeIcon className="w-5 h-5 sm:w-5 sm:h-5" />
              <span>Like</span>
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-[24px] bg-secondary text-secondary-foreground hover:bg-tertiary text-sm sm:text-base font-semibold transition-all active:scale-95"
              title="Share"
            >
              <Share2 className="w-5 h-5 sm:w-5 sm:h-5" />
              <span>Share</span>
            </button>
            <button
              onClick={handleFavourite}
              className={`flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-[24px] text-sm sm:text-base font-semibold transition-all active:scale-95 ${
                isFav ? 'bg-yellow-500/20 text-yellow-400' : 'bg-secondary text-secondary-foreground hover:bg-tertiary'
              }`}
              title={isFav ? 'Saved' : 'Save'}
            >
              {isFav ? <Star className="w-5 h-5 sm:w-5 sm:h-5 fill-current" /> : <Plus className="w-5 h-5 sm:w-5 sm:h-5" />}
              <span>{isFav ? 'Saved' : 'Save'}</span>
            </button>
            <button
              onClick={() => setShowDownload(true)}
              className="flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-[24px] bg-accent/20 text-accent hover:bg-accent/30 text-sm sm:text-base font-semibold transition-all active:scale-95"
              title="Download"
            >
              <Download className="w-5 h-5 sm:w-5 sm:h-5" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Meta - Only show if there's content */}
        {post && (post.description || post.createdAt) && (
          <div className="mt-4 p-3 sm:p-4 bg-card sm:rounded-[12px] mx-0 sm:mx-0">
            {post.createdAt && (
              <p className="text-sm text-muted-foreground mb-2">{post.createdAt}</p>
            )}
            {post.description && post.description.trim() && (
              <p className="text-sm text-foreground mb-3">{post.description}</p>
            )}
          </div>
        )}

        {/* Actors */}
        {post && post.actors && post.actors.length > 0 && (
          <div className="mt-4 px-4 sm:px-0">
            <h3 className="text-sm font-semibold text-foreground mb-3">Actors ({post.actors.length})</h3>
            <div className="flex gap-4 flex-wrap">
              {post.actors.map((actorName, index) => {
                return <ActorCircle key={`${actorName}-${index}`} actorName={actorName} />;
              })}
            </div>
          </div>
        )}


      </div>

      {/* ── Related ─────────────────────────────────────────────────── */}
      <div className="lg:w-96 flex-shrink-0 px-4 sm:px-0 lg:px-0 mt-8 lg:mt-0">
        <h3 className="text-sm font-semibold text-foreground mb-4">Related Videos</h3>
        {relatedPosts.length > 0 ? (
          <div className="grid grid-cols-1 gap-y-8">
            {relatedPosts.map(p => <PostBox key={p.id} post={p} />)}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Start the backend to see related videos.</p>
        )}
      </div>
    </div>
  );
}
