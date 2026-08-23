import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchPost, fetchVideoLinks, fetchChannels, fetchActors, fetchPosts, fetchPlayerSettings } from '@/lib/api';
import { addToHistory, toggleFavourite, getFavourites, toggleLike, getLikes } from '@/lib/store';
import SubscribeButton from '@/components/SubscribeButton';
import PostBox from '@/components/PostBox';
import LikeIcon from '@/components/LikeIcon';
import { Share2, Plus, Star, Download, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { VideoLink, VideoSource, Post } from '@/lib/types';
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
            sources.map((source) => {
              // Download link uses /v/ instead of /e/
              const downloadHref = source.downloadUrl 
                || (source.videoId ? `https://streamtape.com/v/${source.videoId}` : (source.embedUrl ? source.embedUrl.replace('/e/', '/v/') : ''));

              return (
                <a
                  key={source.platform + (source.videoId || '')}
                  href={downloadHref}
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
              );
            })
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
  return <SubscribeButton channelId={ch.id} channelName={ch.name} />;
}

// ── Actor Circle ────────────────────────────────────────────────────────────
function ActorCircle({ actorName }: { actorName: string }) {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const { data } = useQuery({ 
    queryKey: ['actors'], 
    queryFn: fetchActors, 
    staleTime: 60_000,
    retry: 2,
  });
  
  const actors = data?.data ?? [];
  const actor = actors.find(a => a.name.trim().toLowerCase() === actorName.trim().toLowerCase());
  
  const handleClick = () => {
    if (actor?.id) {
      navigate(`/actor/${actor.id}`);
    } else {
      navigate(`/actor/${encodeURIComponent(actorName)}`);
    }
  };
  
  return (
    <div onClick={handleClick}
      className="flex flex-col items-center gap-2 group cursor-pointer">
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-secondary border-2 border-white/10 overflow-hidden flex items-center justify-center text-lg font-bold text-muted-foreground uppercase shadow-md group-hover:scale-105 group-hover:border-accent group-hover:shadow-accent/20 transition-all duration-200">
        {actor?.image && !imgError ? (
          <img
            src={actor.image}
            alt={actorName}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-xl text-foreground/80 font-bold">{actorName ? actorName[0].toUpperCase() : '?'}</span>
        )}
      </div>
      <span className="text-xs sm:text-sm font-medium text-muted-foreground group-hover:text-accent transition-colors max-w-[100px] text-center truncate">
        {actorName}
      </span>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function WatchPage() {
  const [params] = useSearchParams();
  const { slug } = useParams<{ slug?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get post passed via navigate state for instantaneous millisecond rendering
  const initialPostFromState = (location.state as { post?: Post })?.post;

  // Support both query param format (?v=id) and slug format (/video/slug--id or /video/slug-id)
  const directVideoId = params.get('v') || '';
  const idFromSlug = slug ? extractPostIdFromSlug(slug) : '';
  const currentTargetId = initialPostFromState?.id || directVideoId || idFromSlug || '';
  
  const [resolvedVideoId, setResolvedVideoId] = useState(currentTargetId);
  
  useEffect(() => {
    if (currentTargetId && currentTargetId !== resolvedVideoId) {
      setResolvedVideoId(currentTargetId);
    }
  }, [currentTargetId]);

  // Fallback resolution for legacy short IDs if needed
  useEffect(() => {
    if (idFromSlug && !directVideoId && !initialPostFromState && idFromSlug.length < 15) {
      fetchPosts(1, 100).then(response => {
        if (response.success) {
          const matchingPost = response.data.find((post: any) => 
            post.id.endsWith(idFromSlug)
          );
          if (matchingPost) {
            setResolvedVideoId(matchingPost.id);
          }
        }
      }).catch(() => {});
    }
  }, [idFromSlug, directVideoId, initialPostFromState]);
  
  const videoId = resolvedVideoId;
  const [liked, setLiked] = useState(() => getLikes().includes(currentTargetId));
  const [isFav, setIsFav] = useState(() => getFavourites().includes(currentTargetId));
  const [showDownload, setShowDownload] = useState(false);

  const { data: postData, isError: postError } = useQuery({
    queryKey: ['post', videoId],
    queryFn: () => fetchPost(videoId).catch((error) => {
      return { success: false, data: null, error: error.message };
    }),
    enabled: !!videoId,
    initialData: (initialPostFromState && initialPostFromState.id === videoId)
      ? { success: true, data: initialPostFromState }
      : undefined,
    staleTime: 60_000,
  });

  // Prepare initial videoData from initialPostFromState for 0ms player mount
  const initialVideoData = useMemo(() => {
    if (initialPostFromState && initialPostFromState.id === videoId && initialPostFromState.videoSources?.length) {
      const srcList: VideoSource[] = initialPostFromState.videoSources.map((s: any, idx: number) => ({
        platform: s.platform || 'streamtape',
        name: initialPostFromState.videoSources.length > 1 ? `Server ${idx + 1}` : 'Streamtape',
        videoId: s.videoId,
        embedUrl: s.embedUrl || `https://streamtape.com/e/${s.videoId}`,
        downloadUrl: s.downloadUrl || `https://streamtape.com/v/${s.videoId}`,
        thumbnail: s.thumbnail || `https://thumb.tapecontent.net/thumb/${s.videoId}/thumb.jpg`
      }));
      return {
        success: true,
        data: {
          postId: videoId,
          videoLink: srcList[0] || null,
          sources: srcList
        }
      };
    }
    return undefined;
  }, [initialPostFromState, videoId]);

  const { data: videoData } = useQuery({
    queryKey: ['videoLinks', videoId],
    queryFn: () => fetchVideoLinks(videoId).catch((error) => {
      return { success: false, data: { postId: videoId, videoLink: null, sources: [] }, error: error.message };
    }),
    enabled: !!videoId,
    initialData: initialVideoData,
    staleTime: 60_000,
  });

  const { data: relatedData } = useQuery({
    queryKey: ['posts', 1, 'all'],
    queryFn: () => import('@/lib/api').then(m => m.fetchPosts(1, 7)).catch(() => {
      return { success: true, data: [] };
    }),
    retry: 0,
    staleTime: 60_000,
  });

  // Fetch player settings for default server
  const { data: playerSettingsData } = useQuery({
    queryKey: ['playerSettings'],
    queryFn: () => fetchPlayerSettings().catch(() => {
      return { success: true, data: { autoPlay: true, defaultServer: 'SERVER_01', updatedAt: '' } };
    }),
    retry: 0,
    staleTime: 300_000,
  });

  const post = postData?.data;
  const videoLink = videoData?.data?.videoLink ?? null;
  const sources = videoData?.data?.sources ?? [];
  const relatedPosts = (relatedData?.data ?? []).filter(p => p.id !== videoId).slice(0, 6);
  const defaultServer = playerSettingsData?.data?.defaultServer || 'SERVER_01';
  
  // Server switching state - initialize based on admin default
  const [selectedServer, setSelectedServer] = useState(() => {
    return defaultServer === 'SERVER_02' ? 1 : 0;
  });
  
  // Update selected server when default changes
  useEffect(() => {
    const defaultIndex = defaultServer === 'SERVER_02' ? 1 : 0;
    // Only auto-switch if we have both servers available
    if (sources.length > 1 && selectedServer !== defaultIndex) {
      setSelectedServer(defaultIndex);
    }
  }, [defaultServer, sources.length]);
  
  // Current embed URL based on selected server
  const embedUrl = sources[selectedServer]?.embedUrl ?? videoLink?.embedUrl ?? null;

  // Update document title, meta tags, and structured JSON-LD data for maximum SEO
  useEffect(() => {
    if (post) {
      addToHistory(post.id);
      setIsFav(getFavourites().includes(post.id));
      setLiked(getLikes().includes(post.id));

      const siteTitle = `${post.title} — Watch Online in HD | XON STREAM`;
      const siteDesc = post.description || `Watch ${post.title} in Full HD quality for free on XON STREAM. High speed streaming.`;
      const postThumb = post.thumbnail || 'https://xonstream.com/siteicon.ico';
      const postUrl = window.location.href;

      document.title = siteTitle;

      // Update meta description
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', siteDesc);

      // Open Graph Tags
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', siteTitle);
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', siteDesc);
      const ogImg = document.querySelector('meta[property="og:image"]');
      if (ogImg) ogImg.setAttribute('content', postThumb);
      const ogUrl = document.querySelector('meta[property="og:url"]');
      if (ogUrl) ogUrl.setAttribute('content', postUrl);

      // Twitter Tags
      const twTitle = document.querySelector('meta[property="twitter:title"]');
      if (twTitle) twTitle.setAttribute('content', siteTitle);
      const twDesc = document.querySelector('meta[property="twitter:description"]');
      if (twDesc) twDesc.setAttribute('content', siteDesc);
      const twImg = document.querySelector('meta[property="twitter:image"]');
      if (twImg) twImg.setAttribute('content', postThumb);

      // JSON-LD Structured VideoObject Schema
      let schemaScript = document.getElementById('jsonld-video-schema') as HTMLScriptElement | null;
      if (!schemaScript) {
        schemaScript = document.createElement('script');
        schemaScript.id = 'jsonld-video-schema';
        schemaScript.type = 'application/ld+json';
        document.head.appendChild(schemaScript);
      }

      schemaScript.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        'name': post.title,
        'description': siteDesc,
        'thumbnailUrl': [postThumb],
        'uploadDate': post.createdAt || new Date().toISOString(),
        'embedUrl': embedUrl || `https://streamtape.com/e/${post.videoSources?.[0]?.videoId || ''}`,
        'contentRating': 'adult',
        'publisher': {
          '@type': 'Organization',
          'name': 'XON STREAM',
          'logo': {
            '@type': 'ImageObject',
            'url': 'https://xonstream.com/siteicon.ico'
          }
        }
      });
    }

    return () => {
      // Clean up dynamic schema on unmount
      const schemaScript = document.getElementById('jsonld-video-schema');
      if (schemaScript) schemaScript.remove();
    };
  }, [post, embedUrl]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link Copied!');
  };

  const handleLike = () => {
    if (!videoId) return;
    const added = toggleLike(videoId);
    toggleFavourite(videoId);
    setLiked(added);
    setIsFav(added);
    toast.success(added ? 'Added to Liked Videos! 👍' : 'Removed from Liked Videos');
  };

  const handleFavourite = () => {
    if (!videoId) return;
    const added = toggleLike(videoId);
    toggleFavourite(videoId);
    setIsFav(added);
    setLiked(added);
    toast.success(added ? 'Added to Liked Videos! 👍' : 'Removed from Liked Videos');
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

        {/* Server Tabs - Centered below video, smaller on mobile */}
        {sources.length > 0 && (
          <div className="flex justify-center gap-2 sm:gap-3 mt-3 sm:mt-4 px-4 sm:px-0">
            {sources.map((source, index) => (
              <button
                key={source.platform}
                onClick={() => setSelectedServer(index)}
                className={`px-3 py-1.5 sm:px-6 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 shadow-sm ${
                  selectedServer === index
                    ? 'bg-accent text-white shadow-accent/30'
                    : 'bg-secondary text-secondary-foreground hover:bg-tertiary hover:shadow-md'
                }`}
              >
                {source.name}
              </button>
            ))}
          </div>
        )}

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
        {post && (post.description || post.createdAt || post.categories?.length) && (
          <div className="mt-4 p-3 sm:p-4 bg-card sm:rounded-[12px] mx-0 sm:mx-0">
            {post.createdAt && (
              <p className="text-sm text-muted-foreground mb-2">{post.createdAt}</p>
            )}
            {post.description && post.description.trim() && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(post.description.trim()) && (
              <p className="text-sm text-foreground mb-3">{post.description}</p>
            )}
            {post.categories && post.categories.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {post.categories.map((cat: string) => (
                  <Link key={cat} to={`/search?category=${encodeURIComponent(cat)}`}
                    className="px-3 py-1 text-xs rounded-[20px] bg-secondary text-secondary-foreground hover:bg-accent/20 hover:text-accent transition-colors cursor-pointer">
                    {cat}
                  </Link>
                ))}
              </div>
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
      <div className="lg:w-96 flex-shrink-0 px-4 sm:px-0 lg:px-0 mt-6 lg:mt-0">
        <h3 className="text-sm font-semibold text-foreground mb-3">Related Videos</h3>
        {relatedPosts.length > 0 ? (
          <div className="grid grid-cols-1 gap-y-3 sm:gap-y-4">
            {relatedPosts.map(p => <PostBox key={p.id} post={p} />)}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Start the backend to see related videos.</p>
        )}
      </div>
    </div>
  );
}
