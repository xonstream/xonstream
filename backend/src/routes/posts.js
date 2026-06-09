const supabase = require('../config/supabase');
const cacheService = require('../services/cacheService');
const streamtapeService = require('../services/streamtape');
const seekstreamingService = require('../services/seekstreaming');
const env = require('../config/env');
const logger = require('../utils/logger');

const { getPostThumbnail, getPostPreview } = require('../utils/postHelpers');

module.exports = async (fastify, opts) => {
  // Public configuration endpoint - serves only safe, non-sensitive config
  fastify.get('/api/public/config', async (request, reply) => {
    try {
      const config = {
        playerDomain: env.SEEKSTREAMING_PLAYER_DOMAIN || 'seekstreaming.com',
        apiBase: '',
        version: '2.0.0'
      };
      
      return reply.send({
        success: true,
        data: config
      });
    } catch (error) {
      logger.error('Error serving public config', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to load configuration'
      });
    }
  });

  // Public support form submission endpoint
  fastify.post('/api/public/support', async (request, reply) => {
    try {
      const { fullName, email, description } = request.body || {};

      if (!fullName || !email || !description) {
        return reply.status(400).send({
          success: false,
          message: 'All fields (Full Name, Email, and Description) are required.'
        });
      }

      const key = `support_request:${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const value = {
        fullName: fullName.trim(),
        email: email.trim(),
        description: description.trim(),
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      const { error } = await supabase
        .from('settings')
        .insert({ key, value });

      if (error) {
        logger.error('Failed to save support request', error);
        return reply.status(500).send({
          success: false,
          message: 'Failed to submit support request.'
        });
      }

      return reply.send({
        success: true,
        message: 'Support request submitted successfully!'
      });
    } catch (error) {
      logger.error('Support submission error', error);
      return reply.status(500).send({
        success: false,
        message: 'An error occurred during submission.'
      });
    }
  });

  fastify.get('/api/posts', async (request, reply) => {
    try {
      const page = parseInt(request.query.page, 10) || 1;
      const perPage = parseInt(request.query.perPage, 10) || 12;
      const category = request.query.category;

      // Build cache key including category
      const cacheKey = `posts:page:${page}:perPage:${perPage}:category:${category || 'all'}`;
      const cached = cacheService.get(cacheKey);
      if (cached && page > 1) {
        return reply.send(cached);
      }

      const skip = (page - 1) * perPage;

      let postIds = null;
      let totalCount = null;

      // If category filter is provided, first get post IDs from post_categories junction table
      if (category && category !== 'all') {
        logger.info(`=== CATEGORY FILTER REQUESTED: ${category} ===`);
        
        // Step 1: Find category ID by name
        const { data: categoryData, error: catError } = await supabase
          .from('categories')
          .select('id')
          .ilike('name', category)
          .single();

        if (catError || !categoryData) {
          logger.warn(`Category not found: ${category}`);
          logger.warn(`Category lookup error:`, catError);
          // Return empty results if category doesn't exist
          return reply.send({
            success: true,
            data: [],
            pagination: {
              page,
              perPage,
              total: 0,
              totalPages: 0
            }
          });
        }

        logger.info(`Found category ID: ${categoryData.id} for name: ${category}`);

        // Step 2: Get all post IDs that have this category
        const { data: postCategories, error: pcError } = await supabase
          .from('post_categories')
          .select('post_id')
          .eq('category_id', categoryData.id);

        if (pcError) {
          logger.error('Error fetching post_categories', pcError);
          throw pcError;
        }

        postIds = (postCategories || []).map(pc => pc.post_id);
        logger.info(`Found ${postIds.length} posts with category ${category}`);

        if (postIds.length === 0) {
          // No posts in this category
          logger.warn(`No posts found in category: ${category}`);
          logger.warn(`Checking if post_categories table has ANY data...`);
          
          const { data: allPostCategories } = await supabase
            .from('post_categories')
            .select('post_id, category_id')
            .limit(10);
          
          logger.warn(`Sample post_categories data:`, allPostCategories);
          
          return reply.send({
            success: true,
            data: [],
            pagination: {
              page,
              perPage,
              total: 0,
              totalPages: 0
            }
          });
        }

        totalCount = postIds.length;
        logger.info(`Total posts in category ${category}: ${totalCount}`);
      }

      // Build the posts query
      let queryBuilder = supabase
        .from('posts')
        .select(`
          *,
          channel:channels(id, name, logo),
          post_actors(actor:actors(id, name)),
          post_video_sources(platform, video_id)
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      // If we have specific post IDs from category filter, use them
      if (postIds) {
        queryBuilder = queryBuilder.in('id', postIds);
      }

      const { data: posts, error, count } = await queryBuilder
        .range(skip, skip + perPage - 1);

      // Fallback: when count is null (can happen with complex multi-join queries in
      // production/PostgREST), run a separate lightweight count-only query so that
      // pagination totals are always accurate.
      let resolvedCount = count;
      if (resolvedCount === null || resolvedCount === undefined) {
        try {
          let countQuery = supabase
            .from('posts')
            .select('id', { count: 'exact', head: true });

          if (postIds) {
            countQuery = countQuery.in('id', postIds);
          }

          const { count: fallbackCount, error: countError } = await countQuery;

          if (!countError && fallbackCount !== null) {
            resolvedCount = fallbackCount;
            logger.info(`Used fallback count query: ${resolvedCount} posts`);
          } else {
            logger.warn('Fallback count query also returned null, defaulting to 0');
            resolvedCount = 0;
          }
        } catch (countErr) {
          logger.warn('Fallback count query failed:', countErr.message);
          resolvedCount = 0;
        }
      }

      if (error) {
        logger.error('Error fetching posts from Supabase', error);
        throw error;
      }

      // Fetch all categories for these posts from the junction table
      const postsWithCategories = await Promise.all((posts || []).map(async (post) => {
        // Get all categories for this post
        const { data: postCats, error: pcError } = await supabase
          .from('post_categories')
          .select('category:categories(name)')
          .eq('post_id', post.id);

        if (pcError) {
          logger.warn(`Error fetching categories for post ${post.id}:`, pcError.message);
        }

        const categories = (postCats || [])
          .map(pc => pc.category?.name)
          .filter(Boolean);

        // Fetch thumbnail and preview from API on-demand (with caching)
        const [thumbnail, previewUrl] = await Promise.all([
          getPostThumbnail(post),
          getPostPreview(post)
        ]);
        
        // DIAGNOSTIC: Log EXACT channel data from Supabase
        logger.info(`Public Post "${post.title}" (ID: ${post.id}):`);
        logger.info(`  - channel_id in DB: ${post.channel_id}`);
        logger.info(`  - channel.name from join: ${post.channel?.name || 'NULL'}`);
        
        return {
          id: post.id,
          title: post.title,
          description: post.description || '',
          thumbnail: thumbnail,
          previewUrl: previewUrl,
          channelName: post.channel?.name || '',
          channelId: post.channel_id, // Return the actual channel_id from DB
          categories: categories,
          category: categories[0] || '', // First category for backward compatibility
          actors: (post.post_actors || []).map(pa => pa.actor?.name || '').filter(name => name),
          videoSources: [], // Empty - will search API by title when needed
          createdAt: post.created_at,
          actorCount: post.post_actors ? post.post_actors.length : 0
        };
      }));

      const total = totalCount !== null ? totalCount : (resolvedCount || 0);
      const result = {
        success: true,
        data: postsWithCategories,
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage)
        }
      };

      cacheService.set(cacheKey, result, 3600);

      return reply.send(result);
    } catch (error) {
      logger.error('Error fetching posts', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch posts'
      });
    }
  });

  fastify.get('/api/posts/:id', async (request, reply) => {
    try {
      const { id } = request.params;

      const cacheKey = `post:${id}`;
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return reply.send({
          success: true,
          data: cached
        });
      }

      const { data: post, error } = await supabase
        .from('posts')
        .select(`
          *,
          channel:channels(id, name, logo, description),
          post_actors(actor:actors(id, name, image, bio)),
          post_video_sources(id, platform, video_id)
        `)
        .eq('id', id)
        .single();

      // Handle "no rows returned" error gracefully
      if (error && error.code === 'PGRST116') {
        return reply.status(404).send({
          success: false,
          message: 'Post not found'
        });
      }

      if (error) {
        logger.error(`Error fetching post ${id}`, error);
        return reply.status(500).send({
          success: false,
          message: 'Failed to fetch post'
        });
      }

      if (!post) {
        return reply.status(404).send({
          success: false,
          message: 'Post not found'
        });
      }

      // Fetch all categories for this post from the junction table
      let categories = [];
      try {
        const { data: postCats, error: catError } = await supabase
          .from('post_categories')
          .select('category:categories(name)')
          .eq('post_id', id);

        if (catError) {
          logger.warn(`Error fetching categories for post ${id}:`, catError.message);
        } else {
          categories = (postCats || [])
            .map(pc => pc.category?.name)
            .filter(Boolean);
        }
      } catch (catErr) {
        logger.warn(`Error fetching categories for post ${id}:`, catErr.message);
      }

      // Format post to include channelName for frontend compatibility
      // Fetch thumbnail and preview from API on-demand
      const [thumbnail, previewUrl] = await Promise.all([
        getPostThumbnail(post),
        getPostPreview(post)
      ]);
      
      const formattedPost = {
        ...post,
        channelName: post.channel?.name || '',
        categories: categories,
        category: categories[0] || '', // First category for backward compatibility
        actors: post.post_actors ? post.post_actors.map(pa => pa.actor?.name).filter(Boolean) : [],
        videoSources: post.post_video_sources || [],
        thumbnail: thumbnail, // Use API-fetched thumbnail
        previewUrl: previewUrl // Use API-fetched preview
      };

      logger.info(`Post ${id} formatted with actors:`, formattedPost.actors);

      cacheService.set(cacheKey, formattedPost, 3600);

      return reply.send({
        success: true,
        data: formattedPost
      });
    } catch (error) {
      logger.error(`Error fetching post ${request.params.id}`, error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch post'
      });
    }
  });

  fastify.get('/api/posts/:id/video', async (request, reply) => {
    try {
      const { id } = request.params;

      const { data: post, error } = await supabase
        .from('posts')
        .select(`
          *,
          post_video_sources(id, platform, video_id)
        `)
        .eq('id', id)
        .single();

      if (error || !post) {
        // Handle "no rows returned" error gracefully
        if (error && error.code === 'PGRST116') {
          return reply.status(404).send({
            success: false,
            message: 'Post not found'
          });
        }
        
        return reply.status(404).send({
          success: false,
          message: 'Post not found'
        });
      }

      const videoSources = post.post_video_sources || [];
      if (videoSources.length === 0) {
        return reply.status(404).send({
          success: false,
          message: 'No video sources found'
        });
      }

      // Build video sources - return all available sources for server switching
      // SERVER 01 = Seekstreaming (primary), SERVER 02 = Streamtape (secondary)
      const sources = [];

      // Always add SERVER 01 (Seekstreaming) first
      const seekSource = videoSources.find(s => s.platform === 'seekstreaming');
      if (seekSource) {
        sources.push({
          platform: 'seekstreaming',
          name: 'SERVER 01',
          videoId: seekSource.video_id,
          embedUrl: seekstreamingService.getPlayerUrl(seekSource.video_id),
          downloadUrl: seekstreamingService.getDownloadUrl(seekSource.video_id),
          thumbnail: null
        });
      }

      // Always add SERVER 02 (Streamtape) second
      const streamtapeSource = videoSources.find(s => s.platform === 'streamtape');
      if (streamtapeSource) {
        const thumbKey = `video:streamtape:thumb:${streamtapeSource.video_id}`;
        let thumbnail = cacheService.get(thumbKey);

        if (!thumbnail) {
          try {
            thumbnail = await streamtapeService.getThumbnail(streamtapeSource.video_id);
          } catch (e) {
            thumbnail = `https://thumb.tapecontent.net/thumb/${streamtapeSource.video_id}/thumb.jpg`;
          }
        }

        sources.push({
          platform: 'streamtape',
          name: 'SERVER 02',
          videoId: streamtapeSource.video_id,
          embedUrl: streamtapeService.getEmbedUrl(streamtapeSource.video_id),
          downloadUrl: null,
          thumbnail: thumbnail
        });
      }

      // Primary video link (first available)
      const videoLink = sources.length > 0 ? {
        platform: sources[0].platform,
        videoId: sources[0].videoId,
        embedUrl: sources[0].embedUrl,
        downloadUrl: sources[0].downloadUrl,
        thumbnail: sources[0].thumbnail
      } : null;

      return reply.send({
        success: true,
        data: {
          postId: id,
          videoLink: videoLink,
          sources: sources
        }
      });
    } catch (error) {
      logger.error(`Error fetching video for post ${request.params.id}`, error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch video'
      });
    }
  });
};
