import { useState, useRef, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchChannels } from '@/lib/api';
import type { Post } from '@/lib/types';
import { generateVideoUrl, formatDate } from '@/lib/utils';

// Format title to capitalize E in episode codes (S01E01 -> S01E01 with big E)
const formatTitle = (title: string): string => {
  if (!title) return '';
  // Match patterns like S01e01, s01E01, S01E01 and ensure E is capitalized
  return title.replace(/([Ss]\d+)([eE])(\d+)/g, (match, season, e, episode) => {
    return season + 'E' + episode;
  });
};

type PostBoxProps = {
  post: Post;
  layout?: 'grid' | 'horizontal';
};

const ThumbnailFallback = memo(function ThumbnailFallback({ title }: { title: string }) {
  return (
    <div className="w-full h-full bg-gradient-to-br from-accent/30 to-secondary flex items-center justify-center">
      <span className="text-3xl font-bold text-foreground/50 uppercase">{(title || '?')[0]}</span>
    </div>
  );
});

const PostBox = memo(function PostBox({ post, layout = 'grid' }: PostBoxProps) {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Thumbnail from post data only (manual entry required)
  const thumbnailUrl = post.thumbnail || '';
  const previewUrl = post.previewUrl || '';

  // Show fallback only if no thumbnail URL available at all, or image load failed
  const showFallback = !thumbnailUrl || imgError;

  // Control video playback based on hover state
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !previewUrl) return;

    console.log('PostBox hover state changed:', { 
      isHovered, 
      hasPreview: !!previewUrl,
      previewUrl: previewUrl.substring(0, 50) + '...' 
    });

    if (isHovered) {
      // Play video on hover
      video.currentTime = 0; // Start from beginning
      video.play().catch(error => {
        console.warn('Video playback failed:', error);
      });
    } else {
      // Pause video when not hovering
      video.pause();
      video.currentTime = 0; // Reset to start
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
    setImgLoading(false);
    setImgError(true);
  };

  const handlePostClick = () => {
    const url = generateVideoUrl(post.id, post.title);
    navigate(url);
  };

  // Handle hover events for preview
  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  if (layout === 'horizontal') {
    return (
      <div 
        className="flex gap-3 group cursor-pointer" 
        onClick={handlePostClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="relative flex-shrink-0 w-40 aspect-video rounded-[12px] overflow-hidden">
          {showFallback ? (
            <ThumbnailFallback title={post.title} />
          ) : (
            <>
              {imgLoading && (
                <div className="absolute inset-0 bg-secondary animate-pulse flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">Loading...</span>
                </div>
              )}
              
              {/* Static thumbnail */}
              <img 
                src={thumbnailUrl} 
                alt={formatTitle(post.title)} 
                className={`w-full h-full object-cover transition-opacity duration-200 ${
                  isHovered && previewUrl ? 'opacity-0' : 'opacity-100'
                }`} 
                loading="lazy" 
                onLoad={handleImageLoad}
                onError={handleImageError} 
              />
              
              {/* Video preview on hover */}
              {previewUrl && (
                <video 
                  ref={videoRef}
                  src={previewUrl} 
                  muted
                  loop
                  playsInline
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
                    isHovered ? 'opacity-100' : 'opacity-0'
                  }`} 
                  preload="auto"
                />
              )}
            </>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground line-clamp-2 hover:text-accent transition-colors">{formatTitle(post.title)}</h3>
          {post.channelName && <p className="text-xs text-muted-foreground mt-1">{post.channelName}</p>}
          <p className="text-xs text-muted-foreground">{formatDate(post.createdAt)}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="group cursor-pointer block card-hover" 
      onClick={handlePostClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative aspect-video rounded-[12px] overflow-hidden">
        {showFallback ? (
          <ThumbnailFallback title={post.title} />
        ) : (
          <>
            {imgLoading && (
              <div className="absolute inset-0 bg-secondary animate-pulse flex items-center justify-center">
                <span className="text-xs text-muted-foreground">Loading...</span>
              </div>
            )}
            
            {/* Static thumbnail - always visible */}
            <img 
              src={thumbnailUrl} 
              alt={formatTitle(post.title)} 
              className={`w-full h-full object-cover transition-opacity duration-200 ${
                isHovered && previewUrl ? 'opacity-0' : 'opacity-100'
              }`} 
              loading="lazy" 
              onLoad={handleImageLoad}
              onError={handleImageError} 
            />
            
            {/* Video preview - plays on hover via useEffect */}
            {previewUrl && (
              <video 
                ref={videoRef}
                src={previewUrl} 
                muted
                loop
                playsInline
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
                  isHovered ? 'opacity-100' : 'opacity-0'
                }`} 
                preload="auto"
              />
            )}
          </>
        )}
      </div>
      <div className="flex gap-3 mt-3">
        <div onClick={goToChannel}
          className="w-8 h-8 rounded-full bg-secondary flex-shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold text-muted-foreground uppercase hover:ring-2 hover:ring-accent/40 transition-all cursor-pointer">
          {ch?.logo ? (
            <img src={ch.logo} alt={post.channelName} className="w-full h-full object-cover" />
          ) : (
            (post.channelName ?? post.title)?.[0] ?? '?'
          )}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-5">{formatTitle(post.title)}</h3>
          {post.channelName && (
            <span onClick={goToChannel}
              className="text-xs text-muted-foreground mt-1 block hover:text-accent transition-colors cursor-pointer">
              {post.channelName}
            </span>
          )}
          <p className="text-xs text-muted-foreground">{formatDate(post.createdAt)}</p>
        </div>
      </div>
    </div>
  );
});

export default PostBox;

