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

  extractChannelName(filename) {
    if (!filename) return null;
    const lower = filename.toLowerCase().trim();
    
    // Check known channel prefixes (order by length descending to match longer ones first)
    const mappings = [
      { prefix: 'cum swapping sis', name: 'Cum Swapping Sis' },
      { prefix: 'caught my coach', name: 'Caught My Coach' },
      { prefix: 'daddys lil angel', name: 'Daddys Lil Angel' },
      { prefix: 'detention girls', name: 'Detention Girls' },
      { prefix: 'my family pies', name: 'My Family Pies' },
      { prefix: 'bounty hunter', name: 'Bounty Hunter' },
      { prefix: 'cheating sis', name: 'Cheating Sis' },
      { prefix: 'family swap', name: 'Family Swap' },
      { prefix: 'driver xxx', name: 'Driver XXX' },
      { prefix: 'driverxxx', name: 'Driver XXX' },
      { prefix: 'lil sis', name: 'Lil Sis' }
    ];
    
    // Replace dots, underscores, dashes, brackets with spaces for matching
    const normalized = lower
      .replace(/[-_.()[\]{}]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
      
    for (const mapping of mappings) {
      if (normalized.startsWith(mapping.prefix)) {
        return mapping.name;
      }
    }
    
    return null;
  }

  async getAllPosts() {
    let allPosts = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data: posts, error } = await supabase
        .from('posts')
        .select('id, title, channel_id')
        .range(from, from + step - 1);
      if (error) {
        logger.error('Error fetching all posts:', error);
        break;
      }
      if (!posts || posts.length === 0) {
        hasMore = false;
      } else {
        allPosts = allPosts.concat(posts);
        if (posts.length < step) hasMore = false;
        else from += step;
      }
    }
    return allPosts;
  }

  async getAllVideoSources() {
    let allSources = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data: sources, error } = await supabase
        .from('post_video_sources')
        .select('platform, video_id, post_id')
        .range(from, from + step - 1);
      if (error) {
        logger.error('Error fetching all video sources:', error);
        break;
      }
      if (!sources || sources.length === 0) {
        hasMore = false;
      } else {
        allSources = allSources.concat(sources);
        if (sources.length < step) hasMore = false;
        else from += step;
      }
    }
    return allSources;
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

  async fetchAllSeekStreamingVideos() {
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
      logger.error('Failed to fetch all SeekStreaming videos', error);
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

  async sync(startPage = 1, endPage = 20) {
    logger.info(`Starting video sync from SeekStreaming only (all pages)...`);

    try {
      // 1. Fetch all existing posts in a loop to avoid PostgREST pagination limits
      const dbPosts = await this.getAllPosts();
      const postTitleToId = new Map(
        dbPosts.map(p => [p.title.toLowerCase().trim(), p.id])
      );

      // 2. Fetch all existing video sources in a loop to avoid PostgREST pagination limits
      const dbSources = await this.getAllVideoSources();
      const existingVideoSourceKeys = new Set(
        dbSources.map(s => `${s.platform}:${s.video_id}`)
      );
      // Build a map from video source key -> post_id for fallback lookup when title doesn't match
      const videoToPostId = new Map();
      dbSources.forEach(s => {
        videoToPostId.set(`${s.platform}:${s.video_id}`, s.post_id);
      });

      // Fetch ALL SeekStreaming videos only (Streamtape is disabled)
      const seekstreamingVideos = await this.fetchAllSeekStreamingVideos();
      const streamtapeVideos = []; // Streamtape permanently disabled

      logger.info(`Fetched ${seekstreamingVideos.length} videos from SeekStreaming (all pages)`);
      logger.info(`Streamtape disabled — 0 videos`);

      const allVideos = [...streamtapeVideos, ...seekstreamingVideos];
      const groupedVideos = this.groupByNormalizedName(allVideos);
      const normalizedNames = Object.keys(groupedVideos);

      logger.info(`Found ${normalizedNames.length} unique video groups`);

      const newPostsToInsert = [];
      const sourcesToAddToExistingPosts = [];
      let skippedCount = 0;

      for (const normalizedName of normalizedNames) {
        const group = groupedVideos[normalizedName];
        
        // Find if a SeekStreaming video is present in this group
        const seekVideo = group.find(v => v.platform === 'seekstreaming');
        
        // Always use formatTitle() so raw filenames never become post titles or channel names
        const rawFilename = seekVideo ? seekVideo.filename : group[0].filename;
        const postTitle = this.formatTitle(rawFilename);

        // Filter out any video sources that are already present in the database
        const newVideoSources = group.filter(video => {
          const key = `${video.platform}:${video.videoId}`;
          return !existingVideoSourceKeys.has(key);
        });

        if (newVideoSources.length === 0) {
          skippedCount += group.length;
          continue; // Everything in this group is already in the database
        }

        // Check if a post with this exact title already exists in the database (case-insensitive)
        const targetPostTitleLower = postTitle.toLowerCase().trim();
        let existingPostId = postTitleToId.get(targetPostTitleLower);

        // FALLBACK: If title lookup missed (e.g. old post has raw-filename title), check if any
        // video in this group already belongs to a post via its video source. This prevents
        // creating a duplicate post for a video whose source already exists under a different title.
        if (!existingPostId) {
          for (const video of group) {
            const foundPostId = videoToPostId.get(`${video.platform}:${video.videoId}`);
            if (foundPostId) {
              existingPostId = foundPostId;
              logger.info(`Title lookup missed for "${postTitle}" — found existing post ${foundPostId} via video source fallback`);
              break;
            }
          }
        }

        // Fetch thumbnail URL from SeekStreaming if not already populated
        let thumbnail = '';
        const seekVideoForThumb = group.find(v => v.platform === 'seekstreaming' && v.thumbnail);
        if (seekVideoForThumb) {
          // Extract the thumbnail path from seekstreaming thumbnail URL
          const match = seekVideoForThumb.thumbnail.match(/https?:\/\/[^\/]+(.*)/);
          if (match && match[1]) {
            thumbnail = match[1];
          } else {
            thumbnail = seekVideoForThumb.thumbnail;
          }
        }

        if (existingPostId) {
          // Post already exists, merge the new video sources into it!
          sourcesToAddToExistingPosts.push({
            postId: existingPostId,
            videoSources: newVideoSources.map(vs => ({
              platform: vs.platform,
              videoId: vs.videoId
            }))
          });
          
          // Mark these new video sources as seen immediately to prevent duplicates in same batch
          newVideoSources.forEach(vs => {
            existingVideoSourceKeys.add(`${vs.platform}:${vs.videoId}`);
          });
        } else {
          // Clean channel name extraction
          const channelName = this.extractChannelName(seekVideo ? seekVideo.filename : group[0].filename);

          const post = {
            title: postTitle,
            description: '',
            channelName: channelName,
            thumbnail: thumbnail,
            videoSources: newVideoSources.map(vs => ({
              platform: vs.platform,
              videoId: vs.videoId
            }))
          };

          newPostsToInsert.push(post);

          // Track this new post title and its video sources to avoid duplicate insertions
          postTitleToId.set(targetPostTitleLower, 'PENDING');
          newVideoSources.forEach(vs => {
            existingVideoSourceKeys.add(`${vs.platform}:${vs.videoId}`);
          });
        }
      }

      let addedCount = 0;

      // Part A: Merge new video sources into existing posts
      if (sourcesToAddToExistingPosts.length > 0) {
        logger.info(`Merging new video sources into ${sourcesToAddToExistingPosts.length} existing posts...`);
        for (const item of sourcesToAddToExistingPosts) {
          const videoSourceInserts = item.videoSources.map(vs => ({
            post_id: item.postId,
            platform: vs.platform,
            video_id: vs.videoId
          }));
          const { error: vsError } = await supabase
            .from('post_video_sources')
            .insert(videoSourceInserts);
          if (vsError) {
            logger.error(`Failed to insert merged video sources for post ID ${item.postId}`, vsError);
          } else {
            addedCount += item.videoSources.length;
          }
        }
      }

      // Part B: Insert new posts with their video sources
      if (newPostsToInsert.length > 0) {
        logger.info(`Inserting ${newPostsToInsert.length} new posts...`);
        for (const post of newPostsToInsert) {
          try {
            let channelId = null;
            if (post.channelName) {
              const { data: existingChannel } = await supabase
                .from('channels')
                .select('id')
                .eq('name', post.channelName)
                .maybeSingle();

              if (existingChannel) {
                channelId = existingChannel.id;
              } else {
                const { data: newChannel, error: channelCreateError } = await supabase
                  .from('channels')
                  .insert({ name: post.channelName })
                  .select('id')
                  .single();

                if (channelCreateError) {
                  logger.error(`Error creating channel ${post.channelName}`, channelCreateError);
                } else if (newChannel) {
                  channelId = newChannel.id;
                  logger.info(`Created new channel: ${post.channelName} (ID: ${channelId})`);
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
                channel_id: channelId
              })
              .select()
              .single();

            if (postError) {
              logger.error(`Failed to create post: ${post.title}`, postError);
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
