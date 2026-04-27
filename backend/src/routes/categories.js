const supabase = require('../config/supabase');
const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');

// Filter out unwanted category names
const BLOCKED_PATTERNS = [
  'example', 'yeh', 'mp4', 'free full video', 'full video', 'free video',
  '⭐️', '⭐', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp'
];

function isBlockedCategory(name) {
  if (!name) return true;
  const lower = name.toLowerCase();
  return BLOCKED_PATTERNS.some(pattern => lower.includes(pattern));
}

module.exports = async (fastify, opts) => {
  fastify.get('/api/categories', async (request, reply) => {
    try {
      const cached = cacheService.get('categories');

      if (cached) {
        // Filter cached categories too
        const filtered = cached.filter(c => !isBlockedCategory(c.name));
        return reply.send({
          success: true,
          data: filtered
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

      // Filter out unwanted categories
      const filteredCategories = (categories || []).filter(c => !isBlockedCategory(c.name));

      cacheService.set('categories', filteredCategories, 18000);

      return reply.send({
        success: true,
        data: filteredCategories
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
