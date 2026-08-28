const fastify = require('fastify')({ logger: false });
const cors = require('@fastify/cors');
const helmet = require('@fastify/helmet');
const cookie = require('@fastify/cookie');
const multipart = require('@fastify/multipart');

const env = require('./src/config/env');
const supabase = require('./src/config/supabase');
const cacheService = require('./src/services/cacheService');
const RAMMonitor = require('./src/utils/ramMonitor');
const logger = require('./src/utils/logger');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const adminAuth = require('./src/middleware/adminAuth');

const postsRoutes = require('./src/routes/posts');
const searchRoutes = require('./src/routes/search');
const actorsRoutes = require('./src/routes/actors');
const channelsRoutes = require('./src/routes/channels');
const categoriesRoutes = require('./src/routes/categories');
const adminRoutes = require('./src/routes/admin');

const ramMonitor = new RAMMonitor(cacheService);

// Automatic migration: Create post_categories table if missing and copy category_id from posts
const migrateCategories = async () => {
  try {
    logger.info('Checking category migration status...');

    // Check if post_categories table exists
    const { data: existingData, error: checkError } = await supabase
      .from('post_categories')
      .select('post_id')
      .limit(1);

    if (checkError && checkError.message.includes('Could not find the table')) {
      logger.warn('post_categories table does not exist, creating it via Supabase API...');

      // We need to create the table - use the Supabase management API
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        logger.error('Missing Supabase credentials in environment variables');
        return;
      }

      // Use the Supabase Management API to create the table
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        }
      });

      // Since we can't create tables via REST API, we'll use a workaround:
      // Try to insert directly - if table doesn't exist, the error will tell user
      logger.error('CRITICAL: post_categories table must be created in Supabase Dashboard');
      logger.error('Please go to: Supabase Dashboard → SQL Editor → Run this command:');
      logger.error('CREATE TABLE post_categories (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, post_id UUID REFERENCES posts(id) ON DELETE CASCADE, category_id UUID REFERENCES categories(id) ON DELETE CASCADE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), UNIQUE(post_id, category_id));');
      return;
    } else if (checkError) {
      logger.error('Error checking post_categories table:', checkError.message);
      return;
    }

    logger.info('post_categories table exists, checking for migrations...');

    // Check if migration is needed
    const { count: postsWithCategory } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .not('category_id', 'is', null);

    const { count: existingAssignments } = await supabase
      .from('post_categories')
      .select('post_id', { count: 'exact', head: true });

    logger.info(`Posts with category_id: ${postsWithCategory || 0}`);
    logger.info(`Existing post_categories entries: ${existingAssignments || 0}`);

    if (existingAssignments > 0) {
      logger.info('Categories already migrated, skipping...');
      return;
    }

    if (postsWithCategory === 0) {
      logger.info('No posts with category_id, nothing to migrate');
      return;
    }

    logger.info(`Migrating ${postsWithCategory} category assignments...`);

    // Get all posts with category_id
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('id, category_id')
      .not('category_id', 'is', null);

    if (postsError) {
      logger.error('Error fetching posts for migration:', postsError);
      return;
    }

    if (!posts || posts.length === 0) {
      logger.info('No posts to migrate');
      return;
    }

    // Insert into post_categories
    const inserts = posts.map(post => ({
      post_id: post.id,
      category_id: post.category_id
    }));

    const { error: insertError, data: inserted } = await supabase
      .from('post_categories')
      .insert(inserts)
      .select();

    if (insertError) {
      logger.error('Error during category migration:', insertError);
      return;
    }

    logger.info(`✓ Successfully migrated ${inserted?.length || 0} category assignments`);
  } catch (error) {
    logger.error('Category migration failed:', error);
  }
};

const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:3000',
  'http://localhost:7860',
  /^https:\/\/.*\.pages\.dev$/,
  /^https:\/\/.*\.qzz\.io$/,
  /^https:\/\/.*\.hf\.space$/
];

const startServer = async () => {
  try {
    logger.info('Starting XonStream Backend...');
    logger.info('Environment loaded successfully');

    logger.info('Supabase configuration loaded');

    await fastify.register(cors, {
      origin: (origin, cb) => {
        if (!origin) {
          return cb(null, true);
        }

        const isAllowed = allowedOrigins.some(allowed => {
          if (allowed instanceof RegExp) {
            return allowed.test(origin);
          }
          return allowed === origin;
        });

        if (isAllowed) {
          return cb(null, true);
        }

        cb(new Error('Not allowed by CORS'), false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    });

    await fastify.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:', 'http:'],
          connectSrc: ["'self'", 'https:', 'http:'],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'", 'https:', 'http:'],
          frameSrc: ["'self'", 'https:', 'http:']
        }
      },
      // Disable Permissions-Policy to avoid browser warnings
      // These features are not used by our application
      permissionsPolicy: false
    });

    await fastify.register(cookie, {
      secret: env.ADMIN_SECRET,
      parseOptions: {}
    });

    await fastify.register(multipart);

    // Health check endpoint for Docker and Hugging Face Spaces
    // Simple check - just verify the server is running and responsive
    fastify.get('/health', async (request, reply) => {
      try {
        return reply.code(200).send({
          status: 'healthy',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          memory: {
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB'
          }
        });
      } catch (error) {
        logger.error('Health check error', error);
        return reply.code(503).send({
          status: 'unhealthy',
          message: 'Health check failed',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // SEO: Dynamic robots.txt
    fastify.get('/robots.txt', async (request, reply) => {
      reply.type('text/plain');
      return `User-agent: *
Allow: /
Disallow: /meow
Disallow: /meow/*
Disallow: /api/admin/*

Sitemap: https://xonstream.qzz.io/sitemap.xml`;
    });

    // SEO: Dynamic sitemap.xml
    fastify.get('/sitemap.xml', async (request, reply) => {
      try {
        const baseUrl = 'https://xonstream.qzz.io';
        const now = new Date().toISOString().split('T')[0];

        // Fetch posts, channels, actors, categories for sitemap
        const [postsRes, channelsRes, actorsRes, categoriesRes] = await Promise.allSettled([
          supabase.from('posts').select('id, title, created_at').order('created_at', { ascending: false }).limit(5000),
          supabase.from('channels').select('id, name'),
          supabase.from('actors').select('id, name'),
          supabase.from('categories').select('id, name')
        ]);

        const posts = postsRes.status === 'fulfilled' && postsRes.value.data ? postsRes.value.data : [];
        const channels = channelsRes.status === 'fulfilled' && channelsRes.value.data ? channelsRes.value.data : [];
        const actors = actorsRes.status === 'fulfilled' && actorsRes.value.data ? actorsRes.value.data : [];
        const categories = categoriesRes.status === 'fulfilled' && categoriesRes.value.data ? categoriesRes.value.data : [];

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/trending</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/popular</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/channels</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/actors</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;

        // Categories
        categories.forEach(c => {
          xml += `
  <url>
    <loc>${baseUrl}/?category=${encodeURIComponent(c.name)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
        });

        // Channels
        channels.forEach(ch => {
          xml += `
  <url>
    <loc>${baseUrl}/channel/${ch.id}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`;
        });

        // Actors
        actors.forEach(act => {
          xml += `
  <url>
    <loc>${baseUrl}/actor/${act.id}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
        });

        // Video Posts
        posts.forEach(p => {
          const slug = p.title
            ? p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
            : 'video';
          const postDate = p.created_at ? new Date(p.created_at).toISOString().split('T')[0] : now;
          xml += `
  <url>
    <loc>${baseUrl}/video/${slug}--${p.id}</loc>
    <lastmod>${postDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>`;
        });

        xml += `\n</urlset>`;

        reply.type('application/xml');
        return xml;
      } catch (err) {
        logger.error('Error generating sitemap:', err);
        reply.type('application/xml');
        return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://xonstream.qzz.io/</loc></url></urlset>`;
      }
    });

    await adminAuth(fastify);

    await fastify.register(postsRoutes);
    await fastify.register(searchRoutes);
    await fastify.register(actorsRoutes);
    await fastify.register(channelsRoutes);
    await fastify.register(categoriesRoutes);
    await fastify.register(adminRoutes);

    fastify.setNotFoundHandler(notFoundHandler);
    fastify.setErrorHandler(errorHandler);

    // Run automatic category migration before warming cache
    logger.info('Starting category migration...');
    await migrateCategories();
    logger.info('Category migration completed');

    logger.info('Starting cache warmup...');
    await cacheService.warmCache();
    logger.info('Cache warmup completed');

    logger.info(`Starting server on port ${env.PORT}...`);
    await fastify.listen({
      port: env.PORT,
      host: '0.0.0.0'
    });

    logger.info(`Server running on port ${env.PORT}`);
    logger.info('XonStream Backend started successfully');
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
};

const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  ramMonitor.stop();

  try {
    await fastify.close();
    logger.info('Fastify server closed');
  } catch (error) {
    logger.error('Error closing Fastify server', error);
  }

  logger.info('Graceful shutdown completed');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', reason);
});

startServer();
