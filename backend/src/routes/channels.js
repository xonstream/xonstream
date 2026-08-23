const supabase = require('../config/supabase');
const cacheService = require('../services/cacheService');
const streamtapeService = require('../services/streamtape');
const logger = require('../utils/logger');

module.exports = async (fastify, opts) => {
  // GET /api/channels - List all channels
  fastify.get('/api/channels', async (request, reply) => {
    try {
      const cached = cacheService.get('channels');
      if (cached) {
        return reply.send({ success: true, data: cached });
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

  // GET /api/channels/:id - Get channel details and posts
  fastify.get('/api/channels/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const page = Math.max(1, parseInt(request.query.page, 10) || 1);
      const perPage = Math.min(100, Math.max(1, parseInt(request.query.perPage, 10) || 12));
      const skip = (page - 1) * perPage;

      // Lookup channel by ID or name
      let { data: channel, error: channelError } = await supabase
        .from('channels')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!channel) {
        const { data: byName } = await supabase
          .from('channels')
          .select('*')
          .ilike('name', id)
          .maybeSingle();
        if (byName) {
          channel = byName;
          channelError = null;
        }
      }

      if (channelError || !channel) {
        return reply.status(404).send({
          success: false,
          message: 'Channel not found'
        });
      }

      // Query posts belonging to this channel
      const { data: posts, error: postsError, count } = await supabase
        .from('posts')
        .select(`
          *,
          channel:channels(id, name, logo),
          post_actors(actor:actors(id, name)),
          post_video_sources(platform, video_id)
        `, { count: 'exact' })
        .eq('channel_id', channel.id)
        .order('created_at', { ascending: false })
        .range(skip, skip + perPage - 1);

      if (postsError) {
        logger.error('Error fetching channel posts:', postsError);
        throw postsError;
      }

      const total = count || 0;
      const postList = posts || [];
      const postIds = postList.map(p => p.id);

      // Fetch categories for posts
      let categoriesMap = {};
      if (postIds.length > 0) {
        try {
          const { data: postCategories } = await supabase
            .from('post_categories')
            .select('post_id, category:categories(name)')
            .in('post_id', postIds);

          if (postCategories) {
            postCategories.forEach(pc => {
              if (!categoriesMap[pc.post_id]) categoriesMap[pc.post_id] = [];
              if (pc.category?.name) categoriesMap[pc.post_id].push(pc.category.name);
            });
          }
        } catch (catErr) {
          logger.warn('Error fetching categories for channel posts:', catErr.message);
        }
      }

      const formattedPosts = postList.map(post => {
        const videoSources = (post.post_video_sources || []).map((vs, index) => ({
          platform: vs.platform || 'streamtape',
          name: (post.post_video_sources?.length || 0) > 1 ? `Server ${index + 1}` : 'Streamtape',
          videoId: vs.video_id,
          embedUrl: streamtapeService.getEmbedUrl(vs.video_id),
          downloadUrl: streamtapeService.getDownloadUrl(vs.video_id),
          thumbnail: streamtapeService.getDefaultThumbnailUrl(vs.video_id)
        }));

        const categories = categoriesMap[post.id] || [];

        return {
          id: post.id,
          title: post.title,
          description: post.description || '',
          thumbnail: post.thumbnail,
          channelName: channel.name,
          channelLogo: channel.logo || '',
          categories: categories,
          category: categories[0] || '',
          actors: (post.post_actors || []).map(pa => pa.actor?.name || '').filter(Boolean),
          videoSources: videoSources,
          createdAt: post.created_at,
          actorCount: post.post_actors ? post.post_actors.length : 0
        };
      });

      return reply.send({
        success: true,
        data: {
          channel: {
            ...channel,
            totalVideos: total
          },
          posts: formattedPosts,
          pagination: {
            page,
            perPage,
            total,
            totalPages: Math.ceil(total / perPage) || 1
          }
        }
      });
    } catch (error) {
      logger.error(`Error fetching channel ${request.params.id}:`, error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch channel'
      });
    }
  });
};
