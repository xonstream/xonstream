const supabase = require('../config/supabase');
const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');

module.exports = async (fastify, opts) => {
  fastify.get('/api/categories', async (request, reply) => {
    try {
      const cached = cacheService.get('categories');

      if (cached) {
        return reply.send({
          success: true,
          data: cached
        });
      }

      const { data: categories, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        logger.error('Error fetching categories', error);
        throw error;
      }

      cacheService.set('categories', categories || [], 18000);

      return reply.send({
        success: true,
        data: categories
      });
    } catch (error) {
      logger.error('Error fetching categories', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch categories'
      });
    }
  });
};
