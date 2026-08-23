import { useState, useRef, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchChannels } from '@/lib/api';
import type { Post } from '@/lib/types';
import { generateVideoUrl, formatDate } from '@/lib/utils';
import { Play, Sparkles } from 'lucide-react';

type PostBoxProps = {
  post: Post;
  layout?: 'grid' | 'horizontal';
};

const ThumbnailFallback = memo(function ThumbnailFallback({ title }: { title: string }) {
  return (
    <div className="w-full h-full bg-gradient-to-br from-accent/20 via-black/40 to-secondary flex flex-col items-center justify-center gap-2">
      <div className="w-12 h-12 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center shadow-lg shadow-accent/10">
        <span className="text-xl font-black text-accent uppercase">{(title || '?')[0]}</span>
      </div>
      <span className="text-[11px] font-medium text-foreground/60 max-w-[80%] text-center truncate">
        {title}
      </span>
    </div>
  );
});

const PostBox = memo(function PostBox({ post, layout = 'grid' }: PostBoxProps) {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Extract Streamtape video ID from videoSources or thumbnail
  const streamtapeId = post.videoSources?.find(s => s.platform === 'streamtape')?.videoId || 
    post.videoSources?.[0]?.videoId || 
    (post.thumbnail && !post.thumbnail.startsWith('http') ? post.thumbnail : '');

  const initialThumb = post.thumbnail
    ? (post.thumbnail.startsWith('http') ? post.thumbnail : `https://thumb.tapecontent.net/thumb/${post.thumbnail}/thumb.jpg`)
    : (streamtapeId ? `https://thumb.tapecontent.net/thumb/${streamtapeId}/thumb.jpg` : '');

  const [currentImgSrc, setCurrentImgSrc] = useState(initialThumb);

  useEffect(() => {
    setCurrentImgSrc(initialThumb);
    setImgError(false);
    setImgLoading(true);
  }, [initialThumb]);

  const previewUrl = post.previewUrl || '';
  const showFallback = !currentImgSrc || imgError;

  // Control video playback based on hover state
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !previewUrl) return;

    if (isHovered) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isHovered, previewUrl]);

  // Fetch channels for channel navigation
  const { data: chData } = useQuery({
    queryKey: ['channels'],
    queryFn: fetchChannels,
    staleTime: 300_000,
  });
  const channels = chData?.data ?? [];
  const ch = channels.find(c => c.name === post.channelName);

  const goToChannel = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (ch) navigate(`/channel/${ch.id}`);
    else navigate(`/search?channel=${encodeURIComponent(post.channelName ?? '')}`);
  };

  const handleImageLoad = () => {
    setImgLoading(false);
    setImgError(false);
  };

  const handleImageError = () => {
    if (streamtapeId && currentImgSrc.includes('thumb.tapecontent.net') && currentImgSrc.endsWith('/thumb.jpg')) {
      setCurrentImgSrc(`https://streamtape.com/splash/${streamtapeId}.jpg`);
      setImgLoading(false);
    } else if (streamtapeId && currentImgSrc.includes('/splash/')) {
      setCurrentImgSrc(`https://streamtape.com/thumb/${streamtapeId}.jpg`);
      setImgLoading(false);
    } else {
      setImgLoading(false);
      setImgError(true);
    }
  };

  const handlePostClick = () => {
    const url = generateVideoUrl(post.id, post.title);
    // Instant 0ms navigation with state
    navigate(url, { state: { post } });
  };

  if (layout === 'horizontal') {
    return (
      <div 
        className="flex gap-3.5 group cursor-pointer p-2 rounded-2xl hover:bg-white/[0.03] active:scale-[0.98] transition-all duration-150 select-none" 
        onClick={handlePostClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative flex-shrink-0 w-36 sm:w-44 aspect-video rounded-xl sm:rounded-2xl overflow-hidden bg-black/40 border border-white/5 shadow-md">
          {showFallback ? (
            <ThumbnailFallback title={post.title} />
          ) : (
            <>
              {imgLoading && (
                <div className="absolute inset-0 bg-secondary/80 animate-pulse flex items-center justify-center">
                  <span className="text-[10px] text-muted-foreground">Loading...</span>
                </div>
              )}
              
              <img 
                src={currentImgSrc} 
                alt={post.title} 
                className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                  isHovered && previewUrl ? 'opacity-0' : 'opacity-100'
                }`} 
                loading="lazy" 
                decoding="async"
                onLoad={handleImageLoad}
                onError={handleImageError} 
              />
              
              {previewUrl && (
                <video 
                  ref={videoRef}
                  src={previewUrl} 
                  muted
                  loop
                  playsInline
                  className={`absolute inset-0 w-full h-full object-cover ${
                    isHovered ? 'opacity-100' : 'opacity-0'
                  }`} 
                  preload="none"
                />
              )}

              <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/10 text-[9px] font-bold text-white tracking-wider">
                FHD
              </div>
            </>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground line-clamp-2 group-hover:text-accent transition-colors leading-snug">
            {post.title}
          </h3>
          {post.channelName && (
            <p className="text-[11px] text-muted-foreground mt-1 hover:text-white transition-colors truncate">
              {post.channelName}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground/80 mt-0.5">
            {formatDate(post.createdAt)}
          </p>
        </div>
      </div>
    );
  }

  // Grid & Mobile Post Box Layout
  return (
    <div 
      className="group cursor-pointer block select-none rounded-2xl active:scale-[0.98] transition-all duration-150" 
      onClick={handlePostClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail Card */}
      <div className="relative aspect-video rounded-xl sm:rounded-2xl overflow-hidden bg-black/40 border border-white/5 shadow-md">
        {showFallback ? (
          <ThumbnailFallback title={post.title} />
        ) : (
          <>
            {imgLoading && (
              <div className="absolute inset-0 bg-secondary/80 animate-pulse flex items-center justify-center">
                <span className="text-xs text-muted-foreground">Loading...</span>
              </div>
            )}
            
            <img 
              src={currentImgSrc} 
              alt={post.title} 
              className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                isHovered && previewUrl ? 'opacity-0' : 'opacity-100'
              }`} 
              loading="lazy" 
              decoding="async"
              onLoad={handleImageLoad}
              onError={handleImageError} 
            />
            
            {previewUrl && (
              <video 
                ref={videoRef}
                src={previewUrl} 
                muted
                loop
                playsInline
                className={`absolute inset-0 w-full h-full object-cover ${
                  isHovered ? 'opacity-100' : 'opacity-0'
                }`} 
                preload="none"
              />
            )}

            {/* Quality Badge Overlay */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white tracking-wider flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5 text-accent" /> FHD
              </span>
            </div>
          </>
        )}
      </div>

      {/* Meta Content */}
      <div className="flex gap-2.5 mt-2 px-0.5">
        <div 
          onClick={goToChannel}
          className="w-8 h-8 rounded-full bg-secondary/80 flex-shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold text-muted-foreground uppercase ring-1 ring-white/10 hover:ring-2 hover:ring-accent transition-all cursor-pointer shadow-sm"
        >
          {ch?.logo ? (
            <img src={ch.logo} alt={post.channelName} className="w-full h-full object-cover" loading="lazy" decoding="async" />
          ) : (
            (post.channelName ?? post.title)?.[0] ?? '?'
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-accent transition-colors">
            {post.title}
          </h3>
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground mt-1 truncate">
            {post.channelName && (
              <span 
                onClick={goToChannel}
                className="hover:text-foreground font-medium transition-colors cursor-pointer truncate max-w-[140px]"
              >
                {post.channelName}
              </span>
            )}
            {post.channelName && <span>•</span>}
            <span>{formatDate(post.createdAt)}</span>
          </div>

          {/* Actor Quick Links */}
          {post.actors && post.actors.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {post.actors.slice(0, 2).map((actorName) => (
                <span
                  key={actorName}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/search?actor=${encodeURIComponent(actorName)}`);
                  }}
                  className="text-[10px] text-pink-400/90 hover:text-pink-300 hover:underline cursor-pointer bg-pink-500/10 px-1.5 py-0.5 rounded"
                >
                  {actorName}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default PostBox;
