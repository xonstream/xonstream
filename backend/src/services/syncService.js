const supabase = require('../config/supabase');
const streamtapeService = require('./streamtape');
const seekstreamingService = require('./seekstreaming');
const cacheService = require('./cacheService');
const logger = require('../utils/logger');

class SyncService {
  normalizeFilename(filename) {
    if (!filename) return '';
    
    // Strip extensions (preceded by dot or space) case-insensitively
    let cleaned = filename
      .replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm|ts|m4v)$/i, '')
      .replace(/\b(mp4|mkv|avi|mov|wmv|flv|webm|ts|m4v)\b/gi, '');

    cleaned = cleaned
      .replace(/[-_.()[\]{}]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    // Standardize season/episode code to sXXeYY so duplicate matching is 100% robust
    cleaned = cleaned.replace(/\b[sS](\d+)[eE](\d+)\b/g, (match, sNum, eNum) => {
      const paddedSeason = sNum.padStart(2, '0');
      const paddedEpisode = eNum.padStart(2, '0');
      return `s${paddedSeason}e${paddedEpisode}`;
    });

    return cleaned;
  }

  capitalizeWords(str) {
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  formatTitle(name) {
    // 1. Remove common video extensions case-insensitively (e.g. .mp4, mp4, .mkv, mkv) as separate words
    let cleaned = name
      .replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm|ts|m4v)$/i, '')
      .replace(/\b(mp4|mkv|avi|mov|wmv|flv|webm|ts|m4v)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // 2. Capitalize words
    let capitalized = this.capitalizeWords(cleaned);

    // 3. Format season/episode codes like S01E01, S01E07 (Capitalized & padded to 2 digits)
    capitalized = capitalized.replace(/\b[sS](\d+)[eE](\d+)\b/g, (match, sNum, eNum) => {
      const paddedSeason = sNum.padStart(2, '0');
      const paddedEpisode = eNum.padStart(2, '0');
      return `S${paddedSeason}E${paddedEpisode}`;
    });

    return capitalized;
  }

  async fetchStreamtapeVideos() {
    try {
      const files = await streamtapeService.getAllFiles();
      return files.map(file => ({
        platform: 'streamtape',
        videoId: file.linkid,
        filename: file.name,
        normalizedName: this.normalizeFilename(file.name),
        originalData: file
      }));
    } catch (error) {
      logger.error('Failed to fetch Streamtape videos', error);
      return [];
    }
  }

  async fetchSeekStreamingVideos() {
    try {
      const videos = await seekstreamingService.getAllVideos();
      return videos.map(video => ({
        platform: 'seekstreaming',
        videoId: video.id,
        filename: video.name,
        normalizedName: this.normalizeFilename(video.name),
        thumbnail: seekstreamingService.getThumbnail(video),
        originalData: video
      }));
    } catch (error) {
      logger.error('Failed to fetch SeekStreaming videos', error);
      return [];
    }
  }

  groupByNormalizedName(videos) {
    const groups = {};

    videos.forEach(video => {
      if (!groups[video.normalizedName]) {
        groups[video.normalizedName] = [];
      }
      groups[video.normalizedName].push(video);
    });

    return groups;
  }

  async getExistingPostByTitle(title) {
    const normalizedTitle = title.toLowerCase().trim();
    const { data: existingPost, error } = await supabase
      .from('posts')
      .select('*')
      .ilike('title', normalizedTitle)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      logger.error('Error checking existing post', error);
    }

    return existingPost;
  }

  async fetchSeekStreamingVideosForPages(startPage, endPage) {
    try {
      const videos = await seekstreamingService.getVideosForPages(startPage, endPage);
      return videos.map(video => ({
        platform: 'seekstreaming',
        videoId: video.id,
        filename: video.name,
        normalizedName: this.normalizeFilename(video.name),
        thumbnail: seekstreamingService.getThumbnail(video),
        originalData: video
      }));
    } catch (error) {
      logger.error(`Failed to fetch SeekStreaming videos for pages ${startPage}-${endPage}`, error);
      return [];
    }
  }

  async checkExistingVideoSource(platform, videoId) {
    try {
      const { data, error } = await supabase
        .from('post_video_sources')
        .select('post_id')
        .eq('platform', platform)
        .eq('video_id', videoId)
        .limit(1);

      if (error) {
        logger.error(`Error checking existing video source for ${platform}:${videoId}`, error);
        return null;
      }
      return data && data.length > 0 ? data[0].post_id : null;
    } catch (err) {
      logger.error('Exception checking existing video source', err);
      return null;
    }
  }

  async sync(startPage = 1, endPage = 20) {
    logger.info(`Starting video sync from platforms (SeekStreaming pages ${startPage}-${endPage})...`);

    try {
      // 1. Fetch all existing posts from database to build in-memory normalized title set
      const { data: dbPosts, error: dbPostsError } = await supabase
        .from('posts')
        .select('id, title');
      
      if (dbPostsError) {
        logger.error('Error fetching existing posts for sync deduplication', dbPostsError);
      }
      
      const existingNormalizedTitles = new Set(
        (dbPosts || []).map(p => this.normalizeFilename(p.title)).filter(Boolean)
      );

      // 2. Fetch all existing video sources to build in-memory platform:video_id set
      const { data: dbSources, error: dbSourcesError } = await supabase
        .from('post_video_sources')
        .select('platform, video_id');
        
      if (dbSourcesError) {
        logger.error('Error fetching existing video sources for sync deduplication', dbSourcesError);
      }
      
      const existingVideoSourceKeys = new Set(
        (dbSources || []).map(s => `${s.platform}:${s.video_id}`).filter(Boolean)
      );

      const [streamtapeVideos, seekstreamingVideos] = await Promise.all([
        this.fetchStreamtapeVideos(),
        this.fetchSeekStreamingVideosForPages(startPage, endPage)
      ]);

      logger.info(`Fetched ${streamtapeVideos.length} videos from Streamtape`);
      logger.info(`Fetched ${seekstreamingVideos.length} videos from SeekStreaming (pages ${startPage}-${endPage})`);

      const allVideos = [...streamtapeVideos, ...seekstreamingVideos];
      const groupedVideos = this.groupByNormalizedName(allVideos);
      const normalizedNames = Object.keys(groupedVideos);

      logger.info(`Found ${normalizedNames.length} unique video groups`);

      const newPosts = [];
      let skippedCount = 0;

      for (const normalizedName of normalizedNames) {
        const group = groupedVideos[normalizedName];
        
        // Normalize name for exact comparison
        const normName = this.normalizeFilename(normalizedName);

        // Check if title already exists in DB or is already added in this sync batch
        if (existingNormalizedTitles.has(normName)) {
          skippedCount++;
          continue;
        }

        // Check if any video source in this group already exists in DB or is already added in this sync batch
        let hasDuplicateVideoId = false;
        for (const video of group) {
          const key = `${video.platform}:${video.videoId}`;
          if (existingVideoSourceKeys.has(key)) {
            hasDuplicateVideoId = true;
            logger.info(`Skipping duplicate video group "${normalizedName}": Video ID ${video.videoId} on platform ${video.platform} already exists in DB/batch`);
            break;
          }
        }

        if (hasDuplicateVideoId) {
          skippedCount++;
          continue;
        }

        // Add to our sets immediately to prevent any duplicates within the same sync batch
        existingNormalizedTitles.add(normName);
        group.forEach(video => {
          existingVideoSourceKeys.add(`${video.platform}:${video.videoId}`);
        });

        // Fetch thumbnail URL from SeekStreaming and save to database
        let thumbnail = '';
        const videoSources = [];

        for (const video of group) {
          videoSources.push({
            platform: video.platform,
            videoId: video.videoId
          });

          // Get thumbnail PATH from SeekStreaming (only the part after player domain)
          if (video.platform === 'seekstreaming' && !thumbnail) {
            try {
              const videoDetail = await seekstreamingService.getVideoDetail(video.videoId);
              if (videoDetail && videoDetail.poster) {
                // Save ONLY the path, not full URL
                thumbnail = videoDetail.poster;
              }
            } catch (error) {
              logger.warn(`Failed to fetch thumbnail for ${video.videoId}`);
            }
          }
        }

        const post = {
          title: this.formatTitle(normalizedName),
          description: '',
          actors: [],
          channel: this.formatTitle(normalizedName),
          category: null,
          thumbnail: thumbnail,
          videoSources: videoSources
        };

        newPosts.push(post);
      }

      let addedCount = 0;

      if (newPosts.length > 0) {
        try {
          // Insert posts one by one with their video sources
          for (const post of newPosts) {
             try {
               // Get or create channel for the post
               let channelId = null;
               const channelName = post.channel;

               if (channelName) {
                 // Check if channel exists
                 const { data: existingChannel, error: channelFetchError } = await supabase
                   .from('channels')
                   .select('id')
                   .eq('name', channelName)
                   .single();

                 if (channelFetchError && channelFetchError.code !== 'PGRST116') {
                   logger.error(`Error fetching channel ${channelName}`, channelFetchError);
                 }

                 if (existingChannel) {
                   channelId = existingChannel.id;
                 } else {
                   // Create new channel
                   const { data: newChannel, error: channelCreateError } = await supabase
                     .from('channels')
                     .insert({ name: channelName })
                     .select('id')
                     .single();

                   if (channelCreateError) {
                     logger.error(`Error creating channel ${channelName}`, channelCreateError);
                   } else if (newChannel) {
                     channelId = newChannel.id;
                     logger.info(`Created new channel: ${channelName} (ID: ${channelId})`);
                   }
                 }
               }

               // Insert post
               const { data: newPost, error: postError } = await supabase
                 .from('posts')
                 .insert({
                   title: post.title,
                   description: post.description,
                   thumbnail: post.thumbnail,
                   channel_id: channelId,
                   category_id: post.category
                 })
                 .select()
                 .single();

              if (postError) {
                if (postError.code !== '23505') { // 23505 = unique violation
                  logger.error(`Failed to create post: ${post.title}`, postError);
                }
                continue;
              }

              // Insert video sources
              if (newPost && post.videoSources.length > 0) {
                const videoSourceInserts = post.videoSources.map(vs => ({
                  post_id: newPost.id,
                  platform: vs.platform,
                  video_id: vs.videoId
                }));

                const { error: vsError } = await supabase
                  .from('post_video_sources')
                  .insert(videoSourceInserts);

                if (vsError) {
                  logger.error(`Failed to insert video sources for: ${post.title}`, vsError);
                }
              }

              addedCount++;
            } catch (err) {
              logger.error(`Failed to create post: ${post.title}`, err);
            }
          }

          logger.info(`Inserted ${addedCount} new posts`);
        } catch (error) {
          logger.error('Error inserting posts', error);
        }
      }

      cacheService.invalidateAllPosts();
      await cacheService.warmCache();

      const result = {
        added: addedCount,
        skipped: skippedCount,
        total: addedCount + skippedCount
      };

      logger.info('Sync completed', result);
      return result;
    } catch (error) {
      logger.error('Sync failed', error);
      throw error;
    }
  }
}

module.exports = new SyncService();
