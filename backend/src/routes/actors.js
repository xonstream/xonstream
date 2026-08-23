const supabase = require('../config/supabase');
const cacheService = require('../services/cacheService');
const streamtapeService = require('../services/streamtape');
const logger = require('../utils/logger');

// Helper function to build full thumbnail URL from path
function buildThumbnailUrl(thumbnailPath) {
  if (!thumbnailPath) return '';
  return thumbnailPath;
}

module.exports = async (fastify, opts) => {
  // GET /api/actors - List all actors
  fastify.get('/api/actors', async (request, reply) => {
    try {
      const cached = cacheService.get('actors');
      if (cached) {
        return reply.send({ success: true, data: cached });
      }

      const { data: actors, error } = await supabase
        .from('actors')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        logger.error('Error fetching actors', error);
        throw error;
      }

      cacheService.set('actors', actors || [], 18000);

      return reply.send({
        success: true,
        data: actors || []
      });
    } catch (error) {
      logger.error('Error fetching actors', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch actors'
      });
    }
  });

  // GET /api/actors/:id - Get actor details and their videos
  fastify.get('/api/actors/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const page = Math.max(1, parseInt(request.query.page, 10) || 1);
      const perPage = Math.min(100, Math.max(1, parseInt(request.query.perPage, 10) || 12));
      const skip = (page - 1) * perPage;

      // Find actor by ID or by name
      let { data: actor, error: actorError } = await supabase
        .from('actors')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!actor) {
        const { data: byName } = await supabase
          .from('actors')
          .select('*')
          .ilike('name', id)
          .maybeSingle();
        if (byName) {
          actor = byName;
          actorError = null;
        }
      }

      if (actorError || !actor) {
        // If not found in actors table, construct virtual actor from name param
        actor = {
          id: id,
          name: decodeURIComponent(id),
          image: null,
          cropZoom: 1,
          cropX: 50,
          cropY: 50
        };
      }

      // 1. Get post IDs from post_actors junction table
      let junctionPostIds = [];
      try {
        const { data: postActors } = await supabase
          .from('post_actors')
          .select('post_id')
          .eq('actor_id', actor.id);
        junctionPostIds = (postActors || []).map(pa => pa.post_id).filter(Boolean);
      } catch (err) {
        logger.warn('Error reading post_actors junction table:', err.message);
      }

      // 2. Also search posts containing actor name in title
      let titlePostIds = [];
      try {
        const { data: titlePosts } = await supabase
          .from('posts')
          .select('id')
          .ilike('title', `%${actor.name}%`);
        titlePostIds = (titlePosts || []).map(p => p.id).filter(Boolean);
      } catch (err) {
        logger.warn('Error querying posts by title for actor:', err.message);
      }

      const allMatchingIds = Array.from(new Set([...junctionPostIds, ...titlePostIds]));

      let posts = [];
      let total = 0;

      if (allMatchingIds.length > 0) {
        const { data: postsData, error: postsError, count } = await supabase
          .from('posts')
          .select(`
            *,
            channel:channels(id, name, logo),
            post_actors(actor:actors(id, name)),
            post_video_sources(platform, video_id)
          `, { count: 'exact' })
          .in('id', allMatchingIds)
          .order('created_at', { ascending: false })
          .range(skip, skip + perPage - 1);

        if (postsError) {
          logger.error('Error fetching actor posts:', postsError);
          throw postsError;
        }

        posts = postsData || [];
        total = count || 0;
      }

      // Fetch all categories for these posts
      const postIds = posts.map(p => p.id);
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
          logger.warn('Error fetching categories for actor posts:', catErr.message);
        }
      }

      const formattedPosts = posts.map(post => {
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
          channelName: post.channel?.name || '',
          channelLogo: post.channel?.logo || '',
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
          actor,
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
      logger.error(`Error fetching actor ${request.params.id}:`, error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch actor'
      });
    }
  });
};
