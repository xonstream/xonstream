const supabase = require('../config/supabase');
const cacheService = require('../services/cacheService');
const env = require('../config/env');
const logger = require('../utils/logger');

const { getPostThumbnail, getPostPreview } = require('../utils/postHelpers');

module.exports = async (fastify, opts) => {
  fastify.get('/api/search', async (request, reply) => {
    try {
      const { q: query, actor, channel, category } = request.query;
      const page = parseInt(request.query.page, 10) || 1;
      const perPage = parseInt(request.query.perPage, 10) || 12;

      // Normalize query: remove zero-width characters and trim
      const normalizedQuery = query ? query.replace(/[\u200B-\u200D\uFEFF]/g, '').trim() : '';
      
      logger.info(`Search request received:`, { 
        originalQuery: query, 
        normalizedQuery,
        actor, 
        channel, 
        category, 
        page, 
        perPage 
      });

      const skip = (page - 1) * perPage;

      // If no text query but has filters (channel, actor, category)
      const isFilterOnly = !normalizedQuery || normalizedQuery.length === 0;
      
      if (isFilterOnly && !actor && !channel && !category) {
        logger.warn('Search request with no query or filters');
        return reply.status(400).send({
          success: false,
          message: 'Search query or filter is required'
        });
      }

      const cacheKey = `search:${normalizedQuery || ''}:${actor || ''}:${channel || ''}:${category || ''}:${page}`;
      const cached = cacheService.get(cacheKey);

      if (cached) {
        logger.info('Returning cached search results');
        return reply.send(cached);
      }

      let searchResults = [];
      let total = 0;

      try {
        // Handle category filter first (need to get post IDs)
        let categoryPostIds = null;
        let shouldReturnEmpty = false;
        
        if (category) {
          // Find category ID by name
          const { data: categoryData, error: catError } = await supabase
            .from('categories')
            .select('id')
            .ilike('name', category)
            .single();
          
          if (catError || !categoryData) {
            logger.warn(`Category not found: ${category}`);
            searchResults = [];
            total = 0;
            shouldReturnEmpty = true;
          } else {
            // Get post IDs for this category
            const { data: postCategories } = await supabase
              .from('post_categories')
              .select('post_id')
              .eq('category_id', categoryData.id);
            
            categoryPostIds = (postCategories || []).map(pc => pc.post_id);
            
            if (categoryPostIds.length === 0) {
              logger.warn(`No posts found in category: ${category}`);
              searchResults = [];
              total = 0;
              shouldReturnEmpty = true;
            }
          }
        }

        // Find channel ID by name if provided
        let channelId = null;
        if (channel && !shouldReturnEmpty) {
          const { data: channelData, error: channelLookupError } = await supabase
            .from('channels')
            .select('id')
            .ilike('name', channel)
            .single();
          
          if (channelLookupError || !channelData) {
            logger.warn(`Channel not found: ${channel}`);
            searchResults = [];
            total = 0;
            shouldReturnEmpty = true;
          } else {
            channelId = channelData.id;
          }
        }
        
        // Skip query if we already know there are no results
        if (shouldReturnEmpty) {
          // Skip to formatting with empty results
        } else {

        // Build query based on filters
        let queryBuilder = supabase
          .from('posts')
          .select(`
            *,
            channel:channels(id, name, logo),
            post_actors(actor:actors(id, name)),
            post_video_sources(platform, video_id)
          `, { count: 'exact' });

        // Add text search if provided
        if (normalizedQuery && normalizedQuery.length > 0) {
          // Normalize and split into words, removing extra whitespace
          const words = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
          
          logger.info(`Search words:`, words);
          
          if (words.length > 0) {
            // Build nested AND/OR condition to match all words in any order
            const wordConditions = words.map(word => {
              const escapedWord = word
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/%/g, '\\%')
                .replace(/_/g, '\\_');
              return `or(title.ilike."%${escapedWord}%",description.ilike."%${escapedWord}%")`;
            });
            
            const condition = `and(${wordConditions.join(',')})`;
            queryBuilder = queryBuilder.or(condition);
            
            logger.info(`Search AND condition:`, condition);
          }
        }

        // Apply channel filter
        if (channelId) {
          queryBuilder = queryBuilder.eq('channel_id', channelId);
        }

        // Add actor filter - need to look up actor ID first
        if (actor && !shouldReturnEmpty) {
          // Find actor by name
          const { data: actorData, error: actorLookupError } = await supabase
            .from('actors')
            .select('id')
            .ilike('name', actor)
            .single();
          
          if (actorLookupError || !actorData) {
            logger.warn(`Actor not found: ${actor}`);
            // Return empty results if actor doesn't exist
            searchResults = [];
            total = 0;
            shouldReturnEmpty = true;
          } else {
            // Get post IDs for this actor
            const { data: postActors } = await supabase
              .from('post_actors')
              .select('post_id')
              .eq('actor_id', actorData.id);
            
            const actorPostIds = (postActors || []).map(pa => pa.post_id);
            
            if (actorPostIds.length === 0) {
              logger.warn(`No posts found for actor: ${actor}`);
              searchResults = [];
              total = 0;
              shouldReturnEmpty = true;
            } else {
              queryBuilder = queryBuilder.in('id', actorPostIds);
            }
          }
        }

        // Apply category filter by post IDs
        if (category && categoryPostIds && categoryPostIds.length > 0 && !shouldReturnEmpty) {
          queryBuilder = queryBuilder.in('id', categoryPostIds);
        }

        const { data: results, error: searchError, count } = await queryBuilder
          .order('created_at', { ascending: false })
          .range(skip, skip + perPage - 1);

        logger.info(`Search query executed:`, { 
          resultsCount: results?.length || 0, 
          totalCount: count, 
          hasError: !!searchError,
          errorMessage: searchError?.message
        });

        if (searchError) {
          logger.error('Search query error:', {
            message: searchError.message,
            details: searchError.details,
            hint: searchError.hint,
            code: searchError.code
          });
          // Return empty results instead of 500 error
          searchResults = [];
          total = 0;
        } else {
          searchResults = results || [];
          total = count || 0;
        }
        
        logger.info(`Search results summary:`, {
          query: normalizedQuery,
          words: normalizedQuery.split(/\s+/).filter(w => w.length > 0),
          found: searchResults.length,
          totalInDb: total
        });
        } // Close the else block from shouldReturnEmpty check
      } catch (error) {
        logger.error('Search error', error);
        throw error;
      }

      // Fetch all categories for search results
      const postIds = searchResults.map(p => p.id);
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
          logger.warn('Error fetching categories for search results:', catErr.message);
        }
      }

      const formattedResults = await Promise.all(searchResults.map(async post => {
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
        
        const formatted = {
          id: post.id,
          title: post.title,
          description: post.description || '',
          thumbnail: thumbnail,
          previewUrl: previewUrl,
          channelName: post.channel?.name || '',
          categories: categories,
          category: categories[0] || '', // First category for backward compatibility
          actors: (post.post_actors || []).map(pa => pa.actor?.name || '').filter(name => name),
          videoSources: videoSources,
          createdAt: post.created_at,
          actorCount: post.post_actors ? post.post_actors.length : 0
        };
        
        // Log detailed info for debugging
        if (!formatted.thumbnail) {
          logger.warn(`Post ${formatted.id} has NO thumbnail`, { title: formatted.title });
        }
        
        return formatted;
      }));
      
      logger.info(`Search completed: ${formattedResults.length} results, ${total} total`);
      logger.info(`Pagination: page=${page}, perPage=${perPage}, total=${total}, totalPages=${Math.ceil(total / perPage)}`);

      const result = {
        success: true,
        data: formattedResults,
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage)
        }
      };

      cacheService.set(cacheKey, result, 1800);

      return reply.send(result);
    } catch (error) {
      logger.error('Error performing search', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to perform search'
      });
    }
  });
};
