const supabase = require('../config/supabase');
const cacheService = require('../services/cacheService');
const env = require('../config/env');
const logger = require('../utils/logger');

const { getPostThumbnail, getPostPreview } = require('../utils/postHelpers');

module.exports = async (fastify, opts) => {
  fastify.get('/api/actors', async (request, reply) => {
    try {
      const cached = cacheService.get('actors');

      if (cached) {
        logger.info('Serving actors from cache, count:', cached.length);
        return reply.send({
          success: true,
          data: cached
        });
      }

      const { data: actors, error } = await supabase
        .from('actors')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        logger.error('Error fetching actors', error);
        throw error;
      }

      logger.info(`Fetched ${actors?.length || 0} actors from Supabase`);
      if (actors && actors.length > 0) {
        logger.info('First actor:', actors[0]);
      }

      cacheService.set('actors', actors || [], 18000);

      return reply.send({
        success: true,
        data: actors
      });
    } catch (error) {
      logger.error('Error fetching actors', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch actors'
      });
    }
  });

  fastify.get('/api/actors/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const page = parseInt(request.query.page, 10) || 1;
      const perPage = parseInt(request.query.perPage, 10) || 12;

      const { data: actor, error: actorError } = await supabase
        .from('actors')
        .select('*')
        .eq('id', id)
        .single();

      if (actorError || !actor) {
        return reply.status(404).send({
          success: false,
          message: 'Actor not found'
        });
      }

      const cacheKey = `actor_posts:${id}:page:${page}`;
      const cached = cacheService.get(cacheKey);

      if (cached) {
        return reply.send({
          success: true,
          data: {
            actor,
            posts: cached.posts,
            pagination: cached.pagination
          }
        });
      }

      const skip = (page - 1) * perPage;

      // Get posts for this actor via junction table
      const { data: postActors, error: paError } = await supabase
        .from('post_actors')
        .select('post_id')
        .eq('actor_id', id);

      if (paError) {
        logger.error('Error fetching post actors', paError);
        throw paError;
      }

      const postIds = (postActors || []).map(pa => pa.post_id);
      
      let posts = [];
      let total = 0;

      if (postIds.length > 0) {
        const { data: postsData, error: postsError, count } = await supabase
          .from('posts')
          .select(`
            *,
            channel:channels(id, name, logo),
            post_actors(actor:actors(id, name)),
            post_video_sources(platform, video_id)
          `, { count: 'exact' })
          .in('id', postIds)
          .order('created_at', { ascending: false })
          .range(skip, skip + perPage - 1);

        if (postsError) {
          logger.error('Error fetching posts', postsError);
          throw postsError;
        }

        posts = postsData || [];
        total = count || 0;
      }

      // Fetch all categories for these posts from the junction table
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
          logger.warn('Error fetching categories for actor posts:', catErr.message);
        }
      }

      const formattedPosts = await Promise.all(posts.map(async post => {
        // Map video sources from the joined table
        const videoSources = (post.post_video_sources || []).map(vs => ({
          platform: vs.platform,
          videoId: vs.video_id
        }));
        
        // Get categories from map
        const categories = categoriesMap[post.id] || [];

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
          channelName: post.channel?.name || '',
          categories: categories,
          category: categories[0] || '', // First category for backward compatibility
          actors: [], // Will be populated from post_actors if needed
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
          total,
          totalPages: Math.ceil(total / perPage)
        }
      };

      cacheService.set(cacheKey, result, 3600);

      return reply.send({
        success: true,
        data: {
          actor,
          posts: formattedPosts,
          pagination: result.pagination
        }
      });
    } catch (error) {
      logger.error(`Error fetching actor ${request.params.id}`, error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch actor'
      });
    }
  });
};
