const jwt = require('@fastify/jwt');
const env = require('../config/env');
const logger = require('../utils/logger');

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
      // Try to get token from Authorization header first, then from cookie
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        request.user = fastify.jwt.verify(token);
      } else {
        // Fallback to cookie
        await request.jwtVerify();
      }

      if (!request.user || request.user.username !== env.ADMIN_USERNAME) {
        logger.warn('[ADMIN AUTH] Invalid user in token. Expected:', env.ADMIN_USERNAME, 'Got:', request.user?.username);
        reply.status(401).send({
          success: false,
          message: 'Unauthorized'
        });
        throw new Error('Unauthorized');
      }

      logger.info('[ADMIN AUTH] Authentication successful for:', request.user.username);
    } catch (error) {
      if (error.message === 'Unauthorized') {
        throw error;
      }
      logger.warn('[ADMIN AUTH] JWT verification failed:', error.message, 'Token present:', !!request.headers.authorization);
      reply.status(401).send({
        success: false,
        message: 'Unauthorized'
      });
      throw new Error('Unauthorized');
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

      // Determine cookie settings based on request origin
      const origin = request.headers.origin || '';
      const isHttps = origin.startsWith('https://') || request.protocol === 'https';
      const isHuggingFace = origin.includes('.hf.space') || request.hostname.includes('.hf.space');
      const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1') || request.hostname === 'localhost';

      const cookieOptions = {
        httpOnly: true,
        secure: isHttps, // Secure for HTTPS origins
        sameSite: 'none', // Required for cross-origin cookies
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
      };

      // Only set domain for Hugging Face Spaces (not localhost)
      if (isHuggingFace && !isLocalhost) {
        cookieOptions.domain = '.hf.space';
      }

      logger.info(`[ADMIN LOGIN] Setting cookie - isHttps: ${isHttps}, isHuggingFace: ${isHuggingFace}, isLocalhost: ${isLocalhost}`);
      logger.info(`[ADMIN LOGIN] Cookie options:`, cookieOptions);

      reply.setCookie('admin_session', token, cookieOptions);

      logger.info('[ADMIN LOGIN] Cookie set successfully');

      // Also return token in response for header-based auth
      return reply.send({
        success: true,
        message: 'Login successful',
        token: token // Return token for header-based authentication
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
      // Determine cookie settings based on request origin (same as login)
      const origin = request.headers.origin || '';
      const isHuggingFace = origin.includes('.hf.space') || request.hostname.includes('.hf.space');
      const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1') || request.hostname === 'localhost';

      const clearOptions = {
        path: '/'
      };

      // Match the domain setting from login
      if (isHuggingFace && !isLocalhost) {
        clearOptions.domain = '.hf.space';
      }

      reply.clearCookie('admin_session', clearOptions);

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
