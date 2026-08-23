const supabase = require('../config/supabase');
const cacheService = require('../services/cacheService');
const streamtapeService = require('../services/streamtape');
const logger = require('../utils/logger');

// Helper function to build thumbnail URL
function buildThumbnailUrl(thumbnailPath, videoId) {
  if (thumbnailPath && (thumbnailPath.startsWith('http://') || thumbnailPath.startsWith('https://'))) {
    return thumbnailPath;
  }
  if (videoId) {
    return streamtapeService.getDefaultThumbnailUrl(videoId);
  }
  return thumbnailPath || '';
}

// Helper function to normalize title for matching
function normalizeTitle(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '');
}

module.exports = async (fastify, opts) => {
  // Public configuration endpoint
  fastify.get('/api/public/config', async (request, reply) => {
    try {
      const config = {
        apiBase: '',
        version: '3.0.0',
        primaryPlatform: 'streamtape'
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

  // GET /api/posts - paginated list of posts
  fastify.get('/api/posts', async (request, reply) => {
    try {
      const page = parseInt(request.query.page, 10) || 1;
      const perPage = parseInt(request.query.perPage, 10) || 12;
      const category = request.query.category;

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
        const { data: categoryData, error: catError } = await supabase
          .from('categories')
          .select('id')
          .ilike('name', category)
          .maybeSingle();

        if (catError || !categoryData) {
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

        const { data: postCategories, error: pcError } = await supabase
          .from('post_categories')
          .select('post_id')
          .eq('category_id', categoryData.id);

        if (pcError) {
          logger.error('Error fetching post_categories:', pcError);
          throw pcError;
        }

        postIds = (postCategories || []).map(pc => pc.post_id);

        if (postIds.length === 0) {
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
      }

      // Build the posts query from Supabase
      let queryBuilder = supabase
        .from('posts')
        .select(`
          *,
          channel:channels(id, name, logo),
          post_actors(actor:actors(id, name)),
          post_video_sources(platform, video_id)
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      if (postIds) {
        queryBuilder = queryBuilder.in('id', postIds);
      }

      const { data: posts, error, count } = await queryBuilder
        .range(skip, skip + perPage - 1);

      if (error) {
        logger.error('Error fetching posts from Supabase:', error);
        throw error;
      }

      // Fetch categories for each post
      const postsWithDetails = await Promise.all((posts || []).map(async (post) => {
        const { data: postCats } = await supabase
          .from('post_categories')
          .select('category:categories(name)')
          .eq('post_id', post.id);

        const categories = (postCats || [])
          .map(pc => pc.category?.name)
          .filter(Boolean);

        const videoSources = (post.post_video_sources || []).map((vs, index) => ({
          platform: vs.platform || 'streamtape',
          name: (post.post_video_sources?.length || 0) > 1 ? `Server ${index + 1}` : 'Streamtape',
          videoId: vs.video_id,
          embedUrl: streamtapeService.getEmbedUrl(vs.video_id),
          downloadUrl: streamtapeService.getDownloadUrl(vs.video_id),
          thumbnail: streamtapeService.getDefaultThumbnailUrl(vs.video_id)
        }));

        const primaryVideoId = videoSources[0]?.videoId || '';
        const thumbnail = buildThumbnailUrl(post.thumbnail, primaryVideoId);

        return {
          id: post.id,
          title: post.title,
          description: post.description || '',
          thumbnail: thumbnail,
          channelName: post.channel?.name || '',
          channelId: post.channel_id,
          categories: categories,
          category: categories[0] || '',
          actors: (post.post_actors || []).map(pa => pa.actor?.name || '').filter(Boolean),
          videoSources: videoSources,
          createdAt: post.created_at,
          actorCount: post.post_actors ? post.post_actors.length : 0
        };
      }));

      const total = totalCount !== null ? totalCount : (count || 0);
      const result = {
        success: true,
        data: postsWithDetails,
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
      logger.error('Error fetching posts:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch posts'
      });
    }
  });

  // ── Popular Videos (Randomized Weighted Quality Algorithm) ──────────────────
  fastify.get('/api/posts/popular', async (request, reply) => {
    try {
      const page = parseInt(request.query.page, 10) || 1;
      const perPage = parseInt(request.query.perPage, 10) || 12;
      const skip = (page - 1) * perPage;

      // 1. Fetch posts with full relations from Supabase
      const { data: posts, error } = await supabase
        .from('posts')
        .select(`
          *,
          channel:channels(id, name, logo),
          post_actors(actor:actors(id, name)),
          post_video_sources(platform, video_id)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      // 2. Fetch categories junction
      const postIds = (posts || []).map(p => p.id);
      let categoriesMap = {};
      if (postIds.length > 0) {
        const { data: postCats } = await supabase
          .from('post_categories')
          .select('post_id, category:categories(name)')
          .in('post_id', postIds);

        if (postCats) {
          postCats.forEach(pc => {
            if (!categoriesMap[pc.post_id]) categoriesMap[pc.post_id] = [];
            if (pc.category?.name) categoriesMap[pc.post_id].push(pc.category.name);
          });
        }
      }

      // 3. Format & Apply Randomized Weighted Quality Algorithm
      const scoredPosts = (posts || []).map(post => {
        const categories = categoriesMap[post.id] || [];
        const videoSources = (post.post_video_sources || []).map((vs, index) => ({
          platform: vs.platform || 'streamtape',
          name: (post.post_video_sources?.length || 0) > 1 ? `Server ${index + 1}` : 'Streamtape',
          videoId: vs.video_id,
          embedUrl: streamtapeService.getEmbedUrl(vs.video_id),
          downloadUrl: streamtapeService.getDownloadUrl(vs.video_id),
          thumbnail: streamtapeService.getDefaultThumbnailUrl(vs.video_id)
        }));

        const primaryVideoId = videoSources[0]?.videoId || '';
        const thumbnail = buildThumbnailUrl(post.thumbnail, primaryVideoId);
        const actors = (post.post_actors || []).map(pa => pa.actor?.name || '').filter(Boolean);

        // Quality Scoring:
        let qualityScore = 50;
        if (actors.length > 0) qualityScore += 30;
        if (categories.length > 0) qualityScore += 20;
        if (post.thumbnail) qualityScore += 15;
        if (post.description && post.description.trim().length > 10) qualityScore += 10;
        if (videoSources.length > 0) qualityScore += 20;

        // Seeded/stochastic random temperature:
        const randomMultiplier = 0.5 + Math.random() * 0.9;
        const finalPopularScore = qualityScore * randomMultiplier;

        return {
          id: post.id,
          title: post.title,
          description: post.description || '',
          thumbnail: thumbnail,
          channelName: post.channel?.name || '',
          channelId: post.channel_id,
          categories: categories,
          category: categories[0] || '',
          actors: actors,
          videoSources: videoSources,
          createdAt: post.created_at,
          actorCount: actors.length,
          _popularScore: finalPopularScore
        };
      });

      // Sort by popular score descending
      scoredPosts.sort((a, b) => b._popularScore - a._popularScore);

      const total = scoredPosts.length;
      const paginated = scoredPosts.slice(skip, skip + perPage);

      return reply.send({
        success: true,
        data: paginated,
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage)
        }
      });
    } catch (error) {
      logger.error('Error fetching popular posts:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch popular posts'
      });
    }
  });

  // ── Trending Videos (Velocity & Time-Decay Momentum Algorithm) ─────────────
  fastify.get('/api/posts/trending', async (request, reply) => {
    try {
      const page = parseInt(request.query.page, 10) || 1;
      const perPage = parseInt(request.query.perPage, 10) || 12;
      const skip = (page - 1) * perPage;

      // 1. Fetch recent posts
      const { data: posts, error } = await supabase
        .from('posts')
        .select(`
          *,
          channel:channels(id, name, logo),
          post_actors(actor:actors(id, name)),
          post_video_sources(platform, video_id)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      // 2. Fetch categories
      const postIds = (posts || []).map(p => p.id);
      let categoriesMap = {};
      if (postIds.length > 0) {
        const { data: postCats } = await supabase
          .from('post_categories')
          .select('post_id, category:categories(name)')
          .in('post_id', postIds);

        if (postCats) {
          postCats.forEach(pc => {
            if (!categoriesMap[pc.post_id]) categoriesMap[pc.post_id] = [];
            if (pc.category?.name) categoriesMap[pc.post_id].push(pc.category.name);
          });
        }
      }

      const now = Date.now();

      // 3. Apply Velocity & Decay Algorithm
      const trendingPosts = (posts || []).map(post => {
        const categories = categoriesMap[post.id] || [];
        const videoSources = (post.post_video_sources || []).map((vs, index) => ({
          platform: vs.platform || 'streamtape',
          name: (post.post_video_sources?.length || 0) > 1 ? `Server ${index + 1}` : 'Streamtape',
          videoId: vs.video_id,
          embedUrl: streamtapeService.getEmbedUrl(vs.video_id),
          downloadUrl: streamtapeService.getDownloadUrl(vs.video_id),
          thumbnail: streamtapeService.getDefaultThumbnailUrl(vs.video_id)
        }));

        const primaryVideoId = videoSources[0]?.videoId || '';
        const thumbnail = buildThumbnailUrl(post.thumbnail, primaryVideoId);
        const actors = (post.post_actors || []).map(pa => pa.actor?.name || '').filter(Boolean);

        const postCreatedAt = post.created_at ? new Date(post.created_at).getTime() : now;
        const hoursAgo = Math.max(0.1, (now - postCreatedAt) / (1000 * 60 * 60));

        // Engagement points:
        const actorWeight = actors.length ? 1.8 : 1.0;
        const catWeight = categories.length ? 1.4 : 1.0;
        const descWeight = post.description && post.description.length > 15 ? 1.2 : 1.0;
        const basePoints = 500 * actorWeight * catWeight * descWeight;

        // Time-decay formula (gravity = 1.35)
        const trendingScore = basePoints / Math.pow(hoursAgo + 2, 1.35);

        return {
          id: post.id,
          title: post.title,
          description: post.description || '',
          thumbnail: thumbnail,
          channelName: post.channel?.name || '',
          channelId: post.channel_id,
          categories: categories,
          category: categories[0] || '',
          actors: actors,
          videoSources: videoSources,
          createdAt: post.created_at,
          actorCount: actors.length,
          _trendingScore: trendingScore
        };
      });

      // Sort by trending score descending
      trendingPosts.sort((a, b) => b._trendingScore - a._trendingScore);

      const total = trendingPosts.length;
      const paginated = trendingPosts.slice(skip, skip + perPage);

      return reply.send({
        success: true,
        data: paginated,
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage)
        }
      });
    } catch (error) {
      logger.error('Error fetching trending posts:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch trending posts'
      });
    }
  });

  // GET /api/posts/:id - single post details
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

      let { data: post, error } = await supabase
        .from('posts')
        .select(`
          *,
          channel:channels(id, name, logo, description),
          post_actors(actor:actors(id, name, image, bio)),
          post_video_sources(id, platform, video_id)
        `)
        .eq('id', id)
        .maybeSingle();

      // If not found and ID might be short ID / suffix, search by suffix
      if (!post && id && id.length < 30) {
        const { data: fallbackPosts } = await supabase
          .from('posts')
          .select(`
            *,
            channel:channels(id, name, logo, description),
            post_actors(actor:actors(id, name, image, bio)),
            post_video_sources(id, platform, video_id)
          `)
          .ilike('id', `%${id}`)
          .limit(1);

        if (fallbackPosts && fallbackPosts.length > 0) {
          post = fallbackPosts[0];
          error = null;
        }
      }

      if (error || !post) {
        return reply.status(404).send({
          success: false,
          message: 'Post not found'
        });
      }

      // Fetch categories
      let categories = [];
      try {
        const { data: postCats } = await supabase
          .from('post_categories')
          .select('category:categories(name)')
          .eq('post_id', post.id);

        categories = (postCats || [])
          .map(pc => pc.category?.name)
          .filter(Boolean);
      } catch (catErr) {
        logger.warn(`Error fetching categories for post ${id}:`, catErr.message);
      }

      const videoSources = (post.post_video_sources || []).map((vs, index) => ({
        id: vs.id,
        platform: vs.platform || 'streamtape',
        name: (post.post_video_sources?.length || 0) > 1 ? `Server ${index + 1}` : 'Streamtape',
        videoId: vs.video_id,
        embedUrl: streamtapeService.getEmbedUrl(vs.video_id),
        downloadUrl: streamtapeService.getDownloadUrl(vs.video_id),
        thumbnail: streamtapeService.getDefaultThumbnailUrl(vs.video_id)
      }));

      const primaryVideoId = videoSources[0]?.videoId || '';
      const thumbnail = buildThumbnailUrl(post.thumbnail, primaryVideoId);

      const formattedPost = {
        ...post,
        channelName: post.channel?.name || '',
        categories: categories,
        category: categories[0] || '',
        actors: post.post_actors ? post.post_actors.map(pa => pa.actor?.name).filter(Boolean) : [],
        videoSources: videoSources,
        thumbnail: thumbnail
      };

      cacheService.set(cacheKey, formattedPost, 3600);

      return reply.send({
        success: true,
        data: formattedPost
      });
    } catch (error) {
      logger.error(`Error fetching post ${request.params.id}:`, error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch post'
      });
    }
  });

  // GET /api/posts/:id/video - video playback details & sources (super speedy, zero delay)
  fastify.get('/api/posts/:id/video', async (request, reply) => {
    try {
      const { id } = request.params;

      const cacheKey = `post:video:${id}`;
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return reply.send({
          success: true,
          data: cached
        });
      }

      let { data: post, error } = await supabase
        .from('posts')
        .select(`
          id,
          title,
          thumbnail,
          post_video_sources(id, platform, video_id)
        `)
        .eq('id', id)
        .maybeSingle();

      // If not found and ID might be short ID / suffix, search by suffix
      if (!post && id && id.length < 30) {
        const { data: fallbackPosts } = await supabase
          .from('posts')
          .select(`
            id,
            title,
            thumbnail,
            post_video_sources(id, platform, video_id)
          `)
          .ilike('id', `%${id}`)
          .limit(1);

        if (fallbackPosts && fallbackPosts.length > 0) {
          post = fallbackPosts[0];
          error = null;
        }
      }

      if (error || !post) {
        return reply.status(404).send({
          success: false,
          message: 'Post not found'
        });
      }

      const rawSources = post.post_video_sources || [];
      if (rawSources.length === 0) {
        return reply.status(404).send({
          success: false,
          message: 'No video sources found'
        });
      }

      const sources = rawSources.map((s, index) => {
        const videoId = s.video_id;
        return {
          id: s.id,
          platform: s.platform || 'streamtape',
          name: rawSources.length > 1 ? `Server ${index + 1}` : 'Streamtape',
          videoId: videoId,
          embedUrl: streamtapeService.getEmbedUrl(videoId),
          downloadUrl: streamtapeService.getDownloadUrl(videoId),
          thumbnail: streamtapeService.getDefaultThumbnailUrl(videoId)
        };
      });

      const videoLink = sources[0] || null;
      const resultData = {
        postId: post.id,
        videoLink: videoLink,
        sources: sources
      };

      cacheService.set(cacheKey, resultData, 3600);

      return reply.send({
        success: true,
        data: resultData
      });
    } catch (error) {
      logger.error(`Error fetching video for post ${request.params.id}:`, error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch video'
      });
    }
  });
};
