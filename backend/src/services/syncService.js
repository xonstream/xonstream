const supabase = require('../config/supabase');
const streamtapeService = require('./streamtape');
const cacheService = require('./cacheService');
const logger = require('../utils/logger');

class SyncService {
  normalizeFilename(filename) {
    const nameWithoutExt = filename.replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm|ts|m4v|3gp|3g2|mpeg|mpg|mts|m2ts|vob|ogv|rm|rmvb|asf|amv|divx|xvid|f4v|h264|h265|hevc|mxf|dv|qt|yuv|m2v|svi|nsv|roq|nut)$/i, '');

    const cleaned = nameWithoutExt
      .replace(/[-_.()[\]{}]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    return cleaned;
  }

  capitalizeWords(str) {
    return str
      .split(' ')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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
      logger.error('Failed to fetch Streamtape videos:', error.message);
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
      .select('id, title')
      .ilike('title', normalizedTitle)
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      logger.error('Error checking existing post:', error.message);
    }

    return existingPost;
  }

  async sync() {
    logger.info('Starting video sync from Streamtape...');

    try {
      const streamtapeVideos = await this.fetchStreamtapeVideos();
      logger.info(`Fetched ${streamtapeVideos.length} videos from Streamtape`);

      if (streamtapeVideos.length === 0) {
        logger.info('No videos found from Streamtape or API not configured.');
        return { added: 0, skipped: 0, total: 0 };
      }

      const groupedVideos = this.groupByNormalizedName(streamtapeVideos);
      const normalizedNames = Object.keys(groupedVideos);
      logger.info(`Found ${normalizedNames.length} unique video groups`);

      let addedCount = 0;
      let skippedCount = 0;

      for (const normalizedName of normalizedNames) {
        if (!normalizedName) continue;

        const group = groupedVideos[normalizedName];
        const displayTitle = this.capitalizeWords(normalizedName);

        // Check if post already exists in Supabase
        const existingPost = await this.getExistingPostByTitle(displayTitle);
        if (existingPost) {
          skippedCount++;
          continue;
        }

        const primaryVideo = group[0];
        let thumbnail = '';
        try {
          thumbnail = await streamtapeService.getThumbnail(primaryVideo.videoId);
        } catch (e) {
          thumbnail = streamtapeService.getDefaultThumbnailUrl(primaryVideo.videoId);
        }

        // Get or create Channel in Supabase
        let channelId = null;
        const channelName = displayTitle;

        try {
          const { data: existingChannel } = await supabase
            .from('channels')
            .select('id')
            .eq('name', channelName)
            .maybeSingle();

          if (existingChannel) {
            channelId = existingChannel.id;
          } else {
            const { data: newChannel } = await supabase
              .from('channels')
              .insert({ name: channelName })
              .select('id')
              .single();

            if (newChannel) {
              channelId = newChannel.id;
            }
          }
        } catch (chErr) {
          logger.warn(`Could not set channel for "${channelName}":`, chErr.message);
        }

        // Insert Post in Supabase
        try {
          const { data: newPost, error: postError } = await supabase
            .from('posts')
            .insert({
              title: displayTitle,
              description: '',
              thumbnail: thumbnail,
              channel_id: channelId,
              category_id: null
            })
            .select()
            .single();

          if (postError) {
            logger.error(`Failed to insert post "${displayTitle}":`, postError.message);
            continue;
          }

          // Insert video sources into post_video_sources
          if (newPost) {
            const videoSources = group.map(v => ({
              post_id: newPost.id,
              platform: 'streamtape',
              video_id: v.videoId
            }));

            const { error: vsError } = await supabase
              .from('post_video_sources')
              .insert(videoSources);

            if (vsError) {
              logger.error(`Failed to insert video source for "${displayTitle}":`, vsError.message);
            }

            addedCount++;
          }
        } catch (err) {
          logger.error(`Failed to create post "${displayTitle}":`, err.message);
        }
      }

      logger.info(`Inserted ${addedCount} new posts into Supabase (${skippedCount} already existed)`);

      cacheService.invalidateAllPosts();
      await cacheService.warmCache();

      const result = {
        added: addedCount,
        skipped: skippedCount,
        total: addedCount + skippedCount
      };

      logger.info('Sync completed successfully:', result);
      return result;
    } catch (error) {
      logger.error('Sync failed:', error);
      throw error;
    }
  }
}

module.exports = new SyncService();
