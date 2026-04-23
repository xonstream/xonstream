const NodeCache = require('node-cache');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: 3600,
      checkperiod: 600,
      useClones: false
    });

    this.cache.on('expired', (key, value) => {
      logger.debug('Cache key expired', { key });
    });

    this.cache.on('error', (err) => {
      logger.error('Cache error', err);
    });
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value, ttl) {
    return this.cache.set(key, value, ttl);
  }

  del(key) {
    return this.cache.del(key);
  }

  flushAll() {
    logger.info('Flushing all cache');
    this.cache.flushAll();
  }

  getStats() {
    return this.cache.getStats();
  }

  async warmCache() {
    logger.info('Warming up cache from Supabase...');

    try {
      // Fetch posts with relations
      const { data: latestPosts, error: postsError } = await supabase
        .from('posts')
        .select(`
          *,
          channel:channels(id, name, logo),
          category:categories(id, name),
          post_actors(actor:actors(id, name, image))
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (postsError) throw postsError;

      // Format posts
      const formattedPosts = (latestPosts || []).map(post => ({
        ...post,
        actors: post.post_actors ? post.post_actors.map(pa => pa.actor) : []
      }));

      this.set('latest_posts', formattedPosts, 18000);
      logger.info(`Cached ${formattedPosts.length} latest posts`);

      // Fetch actors
      const { data: actors, error: actorsError } = await supabase
        .from('actors')
        .select('*')
        .order('name', { ascending: true });

      if (actorsError) throw actorsError;
      this.set('actors', actors || [], 18000);
      logger.info(`Cached ${(actors || []).length} actors`);

      // Fetch channels
      const { data: channels, error: channelsError } = await supabase
        .from('channels')
        .select('*')
        .order('name', { ascending: true });

      if (channelsError) throw channelsError;
      this.set('channels', channels || [], 18000);
      logger.info(`Cached ${(channels || []).length} channels`);

      // Fetch categories
      const { data: categories, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      if (categoriesError) throw categoriesError;
      this.set('categories', categories || [], 18000);
      logger.info(`Cached ${(categories || []).length} categories`);

      logger.info('Cache warmup completed successfully');
      return true;
    } catch (error) {
      logger.error('Cache warmup failed', error);
      throw error;
    }
  }

  invalidatePostCache(postId) {
    this.del(`post:${postId}`);
    this.del('latest_posts');
    logger.debug('Invalidated post cache', { postId });
  }

  invalidateAllPosts() {
    this.del('latest_posts');
    const keys = this.cache.keys();
    const postKeys = keys.filter(key => key.startsWith('post:') || key.startsWith('channel_posts:') || key.startsWith('actor_posts:'));
    postKeys.forEach(key => this.del(key));
    logger.info('Invalidated all posts cache', { count: postKeys.length });
  }

  invalidateActors() {
    this.del('actors');
    logger.info('Invalidated actors cache');
  }

  invalidateChannels() {
    this.del('channels');
    this.del('latest_posts');
    const keys = this.cache.keys();
    const channelKeys = keys.filter(key => key.startsWith('channel_posts:'));
    channelKeys.forEach(key => this.del(key));
    logger.info('Invalidated channels cache', { count: channelKeys.length });
  }

  invalidateCategories() {
    this.del('categories');
    logger.info('Invalidated categories cache');
  }

  invalidateVideoCache(platform, videoId) {
    this.del(`video:${platform}:${videoId}`);
    this.del(`video:${platform}:thumb:${videoId}`);
  }

  rebuildFromDB() {
    return this.warmCache();
  }
}

module.exports = new CacheService();
