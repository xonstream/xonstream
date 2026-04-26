const jwt = require('@fastify/jwt');
const env = require('../config/env');

const adminAuth = async (fastify) => {
  fastify.register(jwt, {
    secret: env.ADMIN_SECRET,
    cookie: {
      cookieName: 'admin_session',
      signed: false
    }
  });

  fastify.decorate('authenticateAdmin', async (request, reply) => {
    try {
      await request.jwtVerify();

      if (!request.user || request.user.username !== env.ADMIN_USERNAME) {
        logger.warn('[ADMIN AUTH] Invalid user in token:', request.user);
        return reply.status(401).send({
          success: false,
          message: 'Unauthorized'
        });
      }
      
      logger.info('[ADMIN AUTH] Authentication successful for:', request.user.username);
    } catch (error) {
      logger.warn('[ADMIN AUTH] JWT verification failed:', error.message);
      return reply.status(401).send({
        success: false,
        message: 'Unauthorized'
      });
    }
  });

  fastify.post('/api/admin/login', async (request, reply) => {
    try {
      const { username, password } = request.body || {};

      logger.info(`[ADMIN LOGIN] Login attempt for username: ${username}`);
      logger.info(`[ADMIN LOGIN] Environment ADMIN_USERNAME: ${env.ADMIN_USERNAME}`);
      logger.info(`[ADMIN LOGIN] Environment ADMIN_PASSWORD exists: ${!!env.ADMIN_PASSWORD}`);
      logger.info(`[ADMIN LOGIN] Environment ADMIN_PASSWORD length: ${env.ADMIN_PASSWORD ? env.ADMIN_PASSWORD.length : 0}`);

      if (!username || !password) {
        logger.warn('[ADMIN LOGIN] Missing username or password');
        return reply.status(400).send({
          success: false,
          message: 'Username and password are required'
        });
      }

      // Debug: Log comparison (without exposing actual password)
      const usernameMatch = username === env.ADMIN_USERNAME;
      const passwordMatch = password === env.ADMIN_PASSWORD;
      
      logger.info(`[ADMIN LOGIN] Username match: ${usernameMatch}`);
      logger.info(`[ADMIN LOGIN] Password match: ${passwordMatch}`);
      logger.info(`[ADMIN LOGIN] Provided password length: ${password.length}`);

      if (!usernameMatch || !passwordMatch) {
        logger.warn(`[ADMIN LOGIN] Invalid credentials - Username match: ${usernameMatch}, Password match: ${passwordMatch}`);
        return reply.status(401).send({
          success: false,
          message: 'Invalid credentials'
        });
      }

      logger.info('[ADMIN LOGIN] Login successful, creating token');

      const token = fastify.jwt.sign(
        { username },
        { expiresIn: '24h' }
      );

      reply.setCookie('admin_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none', // Required for cross-origin cookies
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
      });

      logger.info('[ADMIN LOGIN] Cookie set successfully');

      return reply.send({
        success: true,
        message: 'Login successful'
      });
    } catch (error) {
      logger.error('[ADMIN LOGIN] Login failed:', error);
      return reply.status(500).send({
        success: false,
        message: 'Login failed'
      });
    }
  });

  fastify.post('/api/admin/logout', async (request, reply) => {
    try {
      reply.clearCookie('admin_session', {
        path: '/'
      });

      return reply.send({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: 'Logout failed'
      });
    }
  });
};

module.exports = adminAuth;
