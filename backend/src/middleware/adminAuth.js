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
      // 1. Check Authorization Bearer header first
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        if (token) {
          const decoded = fastify.jwt.verify(token);
          if (decoded && decoded.username === env.ADMIN_USERNAME) {
            request.user = decoded;
            return;
          }
        }
      }

      // 2. Fallback to cookie verification
      await request.jwtVerify();

      if (!request.user || request.user.username !== env.ADMIN_USERNAME) {
        return reply.status(401).send({
          success: false,
          message: 'Unauthorized'
        });
      }
    } catch (error) {
      logger.warn('Admin authentication failed:', error.message);
      return reply.status(401).send({
        success: false,
        message: 'Unauthorized'
      });
    }
  });

  fastify.post('/api/admin/login', async (request, reply) => {
    try {
      const { username, password } = request.body || {};

      if (!username || !password) {
        return reply.status(400).send({
          success: false,
          message: 'Username and password are required'
        });
      }

      // Support either admin username or direct password check
      if ((username && username !== env.ADMIN_USERNAME) || password !== env.ADMIN_PASSWORD) {
        return reply.status(401).send({
          success: false,
          message: 'Invalid credentials'
        });
      }

      const token = fastify.jwt.sign(
        { username: env.ADMIN_USERNAME },
        { expiresIn: '7d' }
      );

      reply.setCookie('admin_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });

      return reply.send({
        success: true,
        token,
        message: 'Login successful'
      });
    } catch (error) {
      logger.error('Admin login error:', error);
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
