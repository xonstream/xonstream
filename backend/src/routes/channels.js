const supabase = require('../config/supabase');
const cacheService = require('../services/cacheService');
const env = require('../config/env');
const logger = require('../utils/logger');

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

      const { data: channel, error: channelError } = await supabase
        .from('channels')
        .select('*')
        .eq('id', id)
        .single();

      if (channelError || !channel) {
        return reply.status(404).send({
          success: false,
          message: 'Channel not found'
        });
      }

      const cacheKey = `channel_posts:${id}:page:${page}`;
      const cached = cacheService.get(cacheKey);

      if (cached) {
        return reply.send({
          success: true,
          data: {
            channel,
            posts: cached.posts,
            pagination: cached.pagination
          }
        });
      }

      const skip = (page - 1) * perPage;

      logger.info(`Fetching posts for channel: ${id}, page: ${page}, perPage: ${perPage}`);

      const { data: posts, error, count } = await supabase
        .from('posts')
        .select(`
          *,
          channel:channels(id, name, logo),
          post_actors(actor:actors(id, name)),
          post_video_sources(platform, video_id)
        `, { count: 'exact' })
        .eq('channel_id', id)
        .order('created_at', { ascending: false })
        .range(skip, skip + perPage - 1);

      logger.info(`Channel ${id} query result: ${posts?.length || 0} posts, total: ${count}`);

      if (error) {
        logger.error('Error fetching channel posts', error);
        throw error;
      }

      const total = count || 0;

      // Fetch all categories for these posts from the junction table
      const postIds = (posts || []).map(p => p.id);
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

      const formattedPosts = (posts || []).map(post => {
        // Map video sources from the joined table
        const videoSources = (post.post_video_sources || []).map(vs => ({
          platform: vs.platform,
          videoId: vs.video_id
        }));
        
        // Get categories from map
        const categories = categoriesMap[post.id] || [];
        
        return {
          id: post.id,
          title: post.title,
          description: post.description || '',
          thumbnail: buildThumbnailUrl(post.thumbnail),
          channelName: post.channel?.name || '',
          categories: categories,
          category: categories[0] || '', // First category for backward compatibility
          actors: (post.post_actors || []).map(pa => pa.actor?.name || '').filter(name => name),
          videoSources: videoSources,
          createdAt: post.created_at,
          actorCount: post.post_actors ? post.post_actors.length : 0
        };
      });

      const result = {
        posts: formattedPosts,
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage)
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
