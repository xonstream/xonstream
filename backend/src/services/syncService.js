const supabase = require('../config/supabase');
const streamtapeService = require('./streamtape');
const seekstreamingService = require('./seekstreaming');
const cacheService = require('./cacheService');
const logger = require('../utils/logger');

class SyncService {
  normalizeFilename(filename) {
    const nameWithoutExt = filename.replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm|ts|m4v)$/i, '');

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

  async sync() {
    logger.info('Starting video sync from platforms...');

    try {
      const [streamtapeVideos, seekstreamingVideos] = await Promise.all([
        this.fetchStreamtapeVideos(),
        this.fetchSeekStreamingVideos()
      ]);

      logger.info(`Fetched ${streamtapeVideos.length} videos from Streamtape`);
      logger.info(`Fetched ${seekstreamingVideos.length} videos from SeekStreaming`);

      const allVideos = [...streamtapeVideos, ...seekstreamingVideos];
      const groupedVideos = this.groupByNormalizedName(allVideos);
      const normalizedNames = Object.keys(groupedVideos);

      logger.info(`Found ${normalizedNames.length} unique video groups`);

      const newPosts = [];
      let skippedCount = 0;

      for (const normalizedName of normalizedNames) {
        const group = groupedVideos[normalizedName];

        const existingPost = await this.getExistingPostByTitle(normalizedName);

        if (existingPost) {
          skippedCount++;
          continue;
        }

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
          title: this.capitalizeWords(normalizedName),
          description: '',
          actors: [],
          channel: null,
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
              // Insert post
              const { data: newPost, error: postError } = await supabase
                .from('posts')
                .insert({
                  title: post.title,
                  description: post.description,
                  thumbnail: post.thumbnail,
                  channel_id: post.channel,
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
