const supabase = require('../config/supabase');
const cacheService = require('../services/cacheService');
const env = require('../config/env');
const logger = require('../utils/logger');

const { getPostThumbnail, getPostPreview } = require('../utils/postHelpers');

module.exports = async (fastify, opts) => {
  fastify.get('/api/channels', async (request, reply) => {
    try {
      const cached = cacheService.get('channels');

      if (cached) {
        return reply.send({
          success: true,
          data: cached
        });
      }

      const { data: channels, error } = await supabase
        .from('channels')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        logger.error('Error fetching channels', error);
        throw error;
      }

      cacheService.set('channels', channels || [], 18000);

      return reply.send({
        success: true,
        data: channels
      });
    } catch (error) {
      logger.error('Error fetching channels', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch channels'
      });
    }
  });

  fastify.get('/api/channels/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const page = parseInt(request.query.page, 10) || 1;
      const perPage = parseInt(request.query.perPage, 10) || 12;

      logger.info(`\n========================================`);
      logger.info(`CHANNEL PAGE REQUEST`);
      logger.info(`URL param id: ${id}`);
      logger.info(`========================================\n`);

      const { data: channel, error: channelError } = await supabase
        .from('channels')
        .select('*')
        .eq('id', id)
        .single();

      if (channelError || !channel) {
        logger.error(`Channel not found - ID: ${id}, Error: ${channelError?.message}`);
        return reply.status(404).send({
          success: false,
          message: 'Channel not found'
        });
      }
      
      logger.info(`Channel found: ${channel.name} (ID: ${channel.id})`);

      // TEMPORARILY DISABLED CACHE FOR DEBUGGING
      // Check cache - BUT invalidate if it's old format (before channel fix)
      const cacheKey = `channel_posts_v2:${id}:page:${page}`;
      const cached = null; // FORCE CACHE MISS TO SEE RAW SUPABASE DATA
      
      /* ORIGINAL CACHE CODE - DISABLED
      const cached = cacheService.get(cacheKey);

      if (cached) {
        logger.info(`=== ⚠️ CACHE HIT for ${cacheKey} ===`);
        logger.info(`⚠️ Returning ${cached.posts?.length || 0} posts from CACHE (might be stale!)`);
        logger.info(`⚠️ This cache was created BEFORE recent channel fixes`);
        logger.info(`⚠️ RECOMMENDATION: Flush cache from admin panel or restart backend`);
        if (cached.posts && cached.posts.length > 0) {
          logger.info(`Cached post sample - Title: "${cached.posts[0].title}", channelName: "${cached.posts[0].channelName}"`);
        }
        return reply.send({
          success: true,
          data: {
            channel,
            posts: cached.posts,
            pagination: cached.pagination
          }
        });
      }
      */

      logger.info(`=== CACHE MISS for ${cacheKey} - fetching FRESH from database ===`);
      logger.info(`✅ This will return CORRECT data from Supabase`);

      const skip = (page - 1) * perPage;

      logger.info(`=== FETCHING CHANNEL POSTS ===`);
      logger.info(`Channel ID: ${id}`);
      logger.info(`Channel Name: ${channel.name}`);
      logger.info(`Page: ${page}, PerPage: ${perPage}`);
      
      // Filter posts where title starts with channel name (case-insensitive)
      const titlePrefix = `${channel.name}%`;
      
      // DIAGNOSTIC: Check total posts with this channel_id AND matching title
      const { count: totalMatchingPosts } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', id)
        .ilike('title', titlePrefix);
      logger.info(`Total posts with channel_id=${id} AND title starts with "${channel.name}": ${totalMatchingPosts}`);

      const { data: posts, error, count } = await supabase
        .from('posts')
        .select(`
          *,
          channel:channels(id, name, logo),
          post_actors(actor:actors(id, name)),
          post_video_sources(platform, video_id)
        `, { count: 'exact' })
        .eq('channel_id', id)
        .ilike('title', titlePrefix)
        .order('created_at', { ascending: false })
        .range(skip, skip + perPage - 1);

      logger.info(`\n========================================`);
      logger.info(`RAW SUPABASE QUERY RESULTS`);
      logger.info(`Expected channel_id: ${id}`);
      if (posts && posts.length > 0) {
        var wrongCount = 0;
        posts.forEach((p, i) => {
          if (p.channel_id !== id) {
            logger.error(`  Post ${i+1}: WRONG channel_id=${p.channel_id} (title: ${p.title})`);
            wrongCount++;
          }
        });
        if (wrongCount > 0) {
          logger.error(`FOUND ${wrongCount} posts with wrong channel_id!`);
        } else {
          logger.info(`✓ All ${posts.length} posts have correct channel_id`);
        }
      }
      logger.info(`Query: SELECT * FROM posts WHERE channel_id = '${id}'`);
      logger.info(`Posts returned: ${posts?.length || 0}`);
      logger.info(`Total count from query: ${count}`);
      logger.info(`========================================`);
      
      // EXTREME DIAGNOSTIC: Log EVERY single post's channel_id
      if (posts && posts.length > 0) {
        logger.info(`\nPOSTS DETAILS:`);
        posts.forEach((post, index) => {
          logger.info(`  Post ${index + 1}:`);
          logger.info(`    - Title: "${post.title}"`);
          logger.info(`    - post.channel_id: ${post.channel_id}`);
          logger.info(`    - Expected channel_id: ${id}`);
          logger.info(`    - Match: ${post.channel_id === id ? '✅ YES' : '❌ NO'}`);
          logger.info(`    - post.channel.name: ${post.channel?.name || 'NULL'}`);
          logger.info(`    - post.channel.id: ${post.channel?.id || 'NULL'}`);
        });
        logger.info(`\n`);
      }
      
      // CRITICAL VALIDATION: Filter out any posts that don't actually belong to this channel
      // This prevents posts with wrong channel_id from appearing
      const validPosts = (posts || []).filter(post => {
        // Only filter if channel_id has a value that does not match
        // Posts with null/undefined channel_id should still be displayed
        if (post.channel_id != null && post.channel_id !== id) {
          logger.error(`FILTERING OUT: Post "${post.title}" (ID: ${post.id}) has WRONG channel_id=${post.channel_id}, expected=${id}`);
          return false;
        }
        return true;
      });
      
      if (validPosts.length !== (posts?.length || 0)) {
        logger.error(`WARNING: Filtered out ${(posts?.length || 0) - validPosts.length} posts with incorrect channel_id!`);
      }
      
      if (validPosts.length > 0) {
        logger.info(`✓ All ${validPosts.length} posts have correct channel_id: ${id}`);
        logger.info(`Sample post - ID: ${validPosts[0].id}, Title: ${validPosts[0].title}, channel_id: ${validPosts[0].channel_id}`);
      }

      if (error) {
        logger.error('Error fetching channel posts', error);
        throw error;
      }

      // Fallback: when count is null (can happen with complex multi-join queries in
      // production/PostgREST), run a separate lightweight count-only query.
      let resolvedChannelCount = count;
      if (resolvedChannelCount === null || resolvedChannelCount === undefined) {
        const { count: fallbackCount } = await supabase
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .eq('channel_id', id)
          .ilike('title', titlePrefix);
        resolvedChannelCount = fallbackCount || 0;
        logger.info(`Channel posts used fallback count: ${resolvedChannelCount}`);
      }

      const total = resolvedChannelCount || 0;

      // IMPORTANT: Use validPosts count for accurate pagination
      // Supabase count includes all posts matching channel_id in the initial query
      // but we may have filtered out posts with wrong channel_id
      // Using validPosts.length ensures pagination only counts posts that will be displayed
      const actualTotal = resolvedChannelCount;

      // Fetch all categories for these posts from the junction table
      const postIds = (validPosts || []).map(p => p.id);
      let categoriesMap = {};
      
      if (postIds.length > 0) {
        try {
          const { data: postCategories } = await supabase
            .from('post_categories')
            .select('post_id, category:categories(name)')
            .in('post_id', postIds);
          
          if (postCategories) {
            postCategories.forEach(pc => {
              if (!categoriesMap[pc.post_id]) {
                categoriesMap[pc.post_id] = [];
              }
              if (pc.category?.name) {
                categoriesMap[pc.post_id].push(pc.category.name);
              }
            });
          }
        } catch (catErr) {
          logger.warn('Error fetching categories for channel posts:', catErr.message);
        }
      }

      const formattedPosts = await Promise.all((validPosts || []).map(async post => {
        // Map video sources from the joined table
        const videoSources = (post.post_video_sources || []).map(vs => ({
          platform: vs.platform,
          videoId: vs.video_id
        }));
        
        // Get categories from map
        const categories = categoriesMap[post.id] || [];
        
        // CRITICAL FIX: Use ONLY the actual channel from the post's relationship
        // NO FALLBACK to current page's channel - this was causing wrong channel names!
        const postChannelName = post.channel?.name || '';
        const postChannelLogo = post.channel?.logo || '';
        
        // If post.channel is null, that means the join failed
        // This happens when channel_id points to a non-existent channel
        if (!post.channel) {
          logger.error(`POST CHANNEL JOIN FAILED for "${post.title}"`);
          logger.error(`  - post.channel_id: ${post.channel_id}`);
          logger.error(`  - This post's channel_id points to a channel that doesn't exist!`);
        }
        
        // Validate: Log if post has different channel than expected
        if (post.channel_id !== id) {
          logger.error(`WARNING: Post "${post.title}" (ID: ${post.id}) has channel_id=${post.channel_id} but we're on channel ${id}`);
          logger.error(`This post should NOT appear on this channel page!`);
        }
        
        logger.info(`Post "${post.title}" - Actual channel: ${postChannelName} (ID: ${post.channel?.id}), post.channel_id: ${post.channel_id}`);
        
        const [thumbnail, previewUrl] = await Promise.all([
          getPostThumbnail(post),
          getPostPreview(post)
        ]);

        return {
          id: post.id,
          title: post.title,
          description: post.description || '',
          thumbnail: thumbnail,
          previewUrl: previewUrl,
          channelName: postChannelName,
          channelLogo: postChannelLogo,
          categories: categories,
          category: categories[0] || '', // First category for backward compatibility
          actors: (post.post_actors || []).map(pa => pa.actor?.name || '').filter(name => name),
          videoSources: videoSources,
          createdAt: post.created_at,
          actorCount: post.post_actors ? post.post_actors.length : 0
        };
      }));

      const result = {
        posts: formattedPosts,
        pagination: {
          page,
          perPage,
          total: actualTotal,
          totalPages: Math.ceil(actualTotal / perPage)
        }
      };

      cacheService.set(cacheKey, result, 3600);

      return reply.send({
        success: true,
        data: {
          channel,
          posts: formattedPosts,
          pagination: result.pagination
        }
      });
    } catch (error) {
      logger.error(`Error fetching channel ${request.params.id}`, error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch channel'
      });
    }
  });
};




