const supabase = require('../config/supabase');
const seekstreamingService = require('../services/seekstreaming');
const cacheService = require('../services/cacheService');
const env = require('../config/env');
const logger = require('./logger');

// Helper function to build full thumbnail URL from path
function buildThumbnailUrl(thumbnailPath) {
  if (!thumbnailPath) return '';
  if (thumbnailPath.startsWith('http://') || thumbnailPath.startsWith('https://')) {
    return thumbnailPath;
  }
  const playerDomain = env.SEEKSTREAMING_PLAYER_DOMAIN || 'seekstreaming.com';
  const domain = playerDomain.startsWith('http') ? playerDomain : `https://${playerDomain}`;
  const path = thumbnailPath.startsWith('/') ? thumbnailPath : `/${thumbnailPath}`;
  return `${domain}${path}`;
}

// Helper function to normalize title for matching
function normalizeTitle(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove special chars
    .replace(/\s+/g, ''); // Remove spaces
}

// Helper function to get thumbnail URL for a post
async function getPostThumbnail(post) {
  // If post has thumbnail path in database, build full URL
  if (post.thumbnail) {
    return buildThumbnailUrl(post.thumbnail);
  }
  
  // Fallback: search API by title if no thumbnail in database
  try {
    const videoListCacheKey = 'seekstreaming:video:list';
    let seekVideos = cacheService.get(videoListCacheKey);
    
    if (!seekVideos) {
      seekVideos = await seekstreamingService.getAllVideos();
      cacheService.set(videoListCacheKey, seekVideos, 300);
    }
    
    const normalizedPostTitle = normalizeTitle(post.title);
    const matchingVideo = seekVideos.find(video => {
      const normalizedVideoTitle = normalizeTitle(video.name);
      return normalizedVideoTitle === normalizedPostTitle;
    });

    if (matchingVideo) {
      const cacheKey = `video:seekstreaming:thumb:${matchingVideo.id}`;
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return cached;
      }

      const videoData = await seekstreamingService.getVideoDetail(matchingVideo.id);
      if (videoData && videoData.poster) {
        const thumbnail = seekstreamingService.getThumbnail(videoData);
        cacheService.set(cacheKey, thumbnail, 3600);
        return thumbnail;
      }
    }

    return '';
  } catch (error) {
    logger.warn(`Failed to fetch thumbnail for post ${post.id || 'unknown'}:`, error.message);
    return '';
  }
}

// Helper function to get preview URL for a post from API on-demand
async function getPostPreview(post) {
  try {
    // Try to find seekstreaming video source first from database relations
    const seekSource = (post.post_video_sources || []).find(vs => vs.platform === 'seekstreaming');
    let seekVideoId = seekSource ? (seekSource.video_id || seekSource.videoId) : null;
    
    if (!seekVideoId && post.videoSources) {
      const vs = post.videoSources.find(s => s.platform === 'seekstreaming');
      seekVideoId = vs ? vs.videoId : null;
    }

    if (seekVideoId) {
      const cacheKey = `video:seekstreaming:preview:${seekVideoId}`;
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return cached;
      }

      const videoData = await seekstreamingService.getVideoDetail(seekVideoId);
      if (videoData && videoData.preview) {
        const preview = seekstreamingService.getPreview(videoData);
        cacheService.set(cacheKey, preview, 3600);
        return preview;
      }
    }

    // Fallback: search by title
    const videoListCacheKey = 'seekstreaming:video:list';
    let seekVideos = cacheService.get(videoListCacheKey);
    
    if (!seekVideos) {
      seekVideos = await seekstreamingService.getAllVideos();
      cacheService.set(videoListCacheKey, seekVideos, 300);
    }
    
    const normalizedPostTitle = normalizeTitle(post.title);
    const matchingVideo = seekVideos.find(video => {
      const normalizedVideoTitle = normalizeTitle(video.name);
      return normalizedVideoTitle === normalizedPostTitle;
    });

    if (matchingVideo) {
      const cacheKey = `video:seekstreaming:preview:${matchingVideo.id}`;
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return cached;
      }

      const videoData = await seekstreamingService.getVideoDetail(matchingVideo.id);
      if (videoData && videoData.preview) {
        const preview = seekstreamingService.getPreview(videoData);
        cacheService.set(cacheKey, preview, 3600);
        return preview;
      }
    }

    return ''; // No preview available
  } catch (error) {
    logger.warn(`Failed to fetch preview for post ${post.id || 'unknown'}:`, error.message);
    return '';
  }
}

module.exports = {
  buildThumbnailUrl,
  getPostThumbnail,
  getPostPreview,
  normalizeTitle
};
