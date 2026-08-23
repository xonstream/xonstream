import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings, FormattedPost, VideoSource } from './types';
import { getSupabase } from './supabase';
import { 
  getEmbedUrl, 
  getDownloadUrl, 
  getDefaultThumbnailUrl, 
  getAllStreamtapeFiles,
  getBatchThumbnails 
} from './streamtape';
import { signJwt, adminAuthMiddleware } from './auth';

const app = new Hono<{ Bindings: Bindings }>();

// ── Helpers ─────────────────────────────────────────────────────────────────
function stripVideoExtensions(title: string): string {
  if (!title || typeof title !== 'string') return '';
  return title
    .replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v|3gp|ts)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanDescription(desc: string | null | undefined): string {
  if (!desc || typeof desc !== 'string') return '';
  const trimmed = desc.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) return '';
  return trimmed;
}

function buildThumbnailUrl(thumbnailPath: string | null | undefined, videoId?: string): string {
  if (thumbnailPath && (thumbnailPath.startsWith('http://') || thumbnailPath.startsWith('https://'))) {
    return thumbnailPath;
  }
  if (thumbnailPath && thumbnailPath.includes('/')) {
    return `https://thumb.tapecontent.net/thumb/${thumbnailPath}`;
  }
  if (videoId) {
    return getDefaultThumbnailUrl(videoId);
  }
  return thumbnailPath || 'https://xonstream.com/siteicon.ico';
}

// ── Global CORS Middleware ──────────────────────────────────────────────────
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin') || '*';
  return cors({
    origin: (orig) => orig || origin,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
    credentials: true,
    maxAge: 86400,
  })(c, next);
});

// ── Health & SEO ────────────────────────────────────────────────────────────
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    runtime: 'Cloudflare Workers (Edge)',
    timestamp: new Date().toISOString()
  });
});

app.get('/robots.txt', (c) => {
  c.header('Content-Type', 'text/plain');
  return c.text(`User-agent: *
Allow: /
Disallow: /meow
Disallow: /meow/*
Disallow: /api/admin/*

Sitemap: https://xonstream.com/sitemap.xml`);
});

app.get('/sitemap.xml', async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const baseUrl = 'https://xonstream.com';
    const now = new Date().toISOString().split('T')[0];

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
  </url>`;

    categories.forEach((cat: any) => {
      xml += `\n  <url><loc>${baseUrl}/?category=${encodeURIComponent(cat.name)}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`;
    });

    channels.forEach((ch: any) => {
      xml += `\n  <url><loc>${baseUrl}/channel/${ch.id}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`;
    });

    actors.forEach((act: any) => {
      xml += `\n  <url><loc>${baseUrl}/actor/${act.id}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
    });

    posts.forEach((p: any) => {
      const slug = p.title ? p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : 'video';
      const postDate = p.created_at ? new Date(p.created_at).toISOString().split('T')[0] : now;
      xml += `\n  <url><loc>${baseUrl}/video/${slug}--${p.id}</loc><lastmod>${postDate}</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>`;
    });

    xml += `\n</urlset>`;
    c.header('Content-Type', 'application/xml');
    return c.text(xml);
  } catch (err: any) {
    c.header('Content-Type', 'application/xml');
    return c.text(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://xonstream.com/</loc></url></urlset>`);
  }
});

// ── Public Config & Player Settings ─────────────────────────────────────────
app.get('/api/public/config', (c) => {
  return c.json({
    success: true,
    data: {
      apiBase: '',
      version: '3.0.0',
      runtime: 'Cloudflare Workers Edge',
      primaryPlatform: 'streamtape'
    }
  });
});

app.get('/api/public/settings/player', async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data, error } = await supabase.from('site_settings').select('*').eq('key', 'player_settings').maybeSingle();
    if (data && data.value) {
      return c.json({ success: true, data: data.value });
    }
    return c.json({
      success: true,
      data: { autoPlay: true, defaultServer: 'SERVER_01', updatedAt: new Date().toISOString() }
    });
  } catch {
    return c.json({
      success: true,
      data: { autoPlay: true, defaultServer: 'SERVER_01', updatedAt: new Date().toISOString() }
    });
  }
});

// ── Posts Endpoints ─────────────────────────────────────────────────────────

// Helper to format posts with junction relations
async function formatPostsRelations(posts: any[], supabase: any): Promise<FormattedPost[]> {
  if (!posts || posts.length === 0) return [];
  const postIds = posts.map(p => p.id);

  let categoriesMap: Record<string, string[]> = {};
  if (postIds.length > 0) {
    const { data: postCats } = await supabase
      .from('post_categories')
      .select('post_id, category:categories(name)')
      .in('post_id', postIds);

    if (postCats) {
      postCats.forEach((pc: any) => {
        if (!categoriesMap[pc.post_id]) categoriesMap[pc.post_id] = [];
        if (pc.category?.name) categoriesMap[pc.post_id].push(pc.category.name);
      });
    }
  }

  return posts.map(post => {
    const categories = categoriesMap[post.id] || [];
    const videoSources: VideoSource[] = (post.post_video_sources || []).map((vs: any, index: number) => ({
      platform: vs.platform || 'streamtape',
      name: (post.post_video_sources?.length || 0) > 1 ? `Server ${index + 1}` : 'Streamtape',
      videoId: vs.video_id,
      embedUrl: getEmbedUrl(vs.video_id),
      downloadUrl: getDownloadUrl(vs.video_id),
      thumbnail: getDefaultThumbnailUrl(vs.video_id)
    }));

    const primaryVideoId = videoSources[0]?.videoId || '';
    const thumbnail = buildThumbnailUrl(post.thumbnail, primaryVideoId);
    const actors = (post.post_actors || []).map((pa: any) => pa.actor?.name || '').filter(Boolean);

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
      actorCount: actors.length
    };
  });
}

// GET /api/posts - Paginated list of posts
app.get('/api/posts', async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(c.req.query('perPage') || '12', 10)));
    const category = c.req.query('category');
    const skip = (page - 1) * perPage;

    let postIds: string[] | null = null;
    let totalCount: number | null = null;

    if (category && category !== 'all') {
      const { data: catData } = await supabase.from('categories').select('id').ilike('name', category).maybeSingle();
      if (catData) {
        const { data: matchedPostCats } = await supabase.from('post_categories').select('post_id').eq('category_id', catData.id);
        const { data: matchedLegacyPosts } = await supabase.from('posts').select('id').eq('category_id', catData.id);

        const idSet = new Set<string>();
        (matchedPostCats || []).forEach((r: any) => idSet.add(r.post_id));
        (matchedLegacyPosts || []).forEach((r: any) => idSet.add(r.id));
        postIds = Array.from(idSet);
      } else {
        postIds = [];
      }
      totalCount = postIds.length;
    }

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

    const { data: posts, error, count } = await queryBuilder.range(skip, skip + perPage - 1);
    if (error) throw error;

    const formatted = await formatPostsRelations(posts || [], supabase);
    const total = totalCount !== null ? totalCount : (count || 0);

    return c.json({
      success: true,
      data: formatted,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage)
      }
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message || 'Failed to fetch posts' }, 500);
  }
});

// GET /api/posts/popular - Randomized Weighted Quality Algorithm
app.get('/api/posts/popular', async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(c.req.query('perPage') || '12', 10)));
    const skip = (page - 1) * perPage;

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

    const formatted = await formatPostsRelations(posts || [], supabase);

    // Apply Randomized Quality Scoring Algorithm
    const scored = formatted.map(post => {
      let qualityScore = 50;
      if (post.actors.length > 0) qualityScore += 30;
      if (post.categories.length > 0) qualityScore += 20;
      if (post.thumbnail) qualityScore += 15;
      if (post.description && post.description.length > 10) qualityScore += 10;
      if (post.videoSources.length > 0) qualityScore += 20;

      const randomMultiplier = 0.5 + Math.random() * 0.9;
      return { ...post, _popularScore: qualityScore * randomMultiplier };
    });

    scored.sort((a, b) => b._popularScore - a._popularScore);

    const total = scored.length;
    const paginated = scored.slice(skip, skip + perPage);

    return c.json({
      success: true,
      data: paginated,
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) }
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message || 'Failed to fetch popular posts' }, 500);
  }
});

// GET /api/posts/trending - Velocity & Time-Decay Momentum Algorithm
app.get('/api/posts/trending', async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(c.req.query('perPage') || '12', 10)));
    const skip = (page - 1) * perPage;

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

    const formatted = await formatPostsRelations(posts || [], supabase);
    const now = Date.now();

    // Apply Velocity & Gravity Decay Algorithm
    const scored = formatted.map(post => {
      const postCreatedAt = post.createdAt ? new Date(post.createdAt).getTime() : now;
      const hoursAgo = Math.max(0.1, (now - postCreatedAt) / (1000 * 60 * 60));

      const actorWeight = post.actors.length ? 1.8 : 1.0;
      const catWeight = post.categories.length ? 1.4 : 1.0;
      const descWeight = post.description && post.description.length > 15 ? 1.2 : 1.0;
      const basePoints = 500 * actorWeight * catWeight * descWeight;

      const trendingScore = basePoints / Math.pow(hoursAgo + 2, 1.35);
      return { ...post, _trendingScore: trendingScore };
    });

    scored.sort((a, b) => b._trendingScore - a._trendingScore);

    const total = scored.length;
    const paginated = scored.slice(skip, skip + perPage);

    return c.json({
      success: true,
      data: paginated,
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) }
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message || 'Failed to fetch trending posts' }, 500);
  }
});

// GET /api/posts/:id - Single post details
app.get('/api/posts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const supabase = getSupabase(c.env);

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

    if (!post && id && id.length < 30) {
      const { data: fallbacks } = await supabase
        .from('posts')
        .select(`
          *,
          channel:channels(id, name, logo, description),
          post_actors(actor:actors(id, name, image, bio)),
          post_video_sources(id, platform, video_id)
        `)
        .ilike('id', `%${id}`)
        .limit(1);

      if (fallbacks && fallbacks.length > 0) {
        post = fallbacks[0];
        error = null;
      }
    }

    if (error || !post) {
      return c.json({ success: false, message: 'Post not found' }, 404);
    }

    const { data: postCats } = await supabase
      .from('post_categories')
      .select('category:categories(name)')
      .eq('post_id', post.id);

    const categories = (postCats || []).map((pc: any) => pc.category?.name).filter(Boolean);

    const videoSources: VideoSource[] = (post.post_video_sources || []).map((vs: any, index: number) => ({
      platform: vs.platform || 'streamtape',
      name: (post.post_video_sources?.length || 0) > 1 ? `Server ${index + 1}` : 'Streamtape',
      videoId: vs.video_id,
      embedUrl: getEmbedUrl(vs.video_id),
      downloadUrl: getDownloadUrl(vs.video_id),
      thumbnail: getDefaultThumbnailUrl(vs.video_id)
    }));

    const primaryVideoId = videoSources[0]?.videoId || '';
    const thumbnail = buildThumbnailUrl(post.thumbnail, primaryVideoId);

    const formattedPost = {
      id: post.id,
      title: post.title,
      description: cleanDescription(post.description),
      thumbnail: thumbnail,
      channelName: post.channel?.name || '',
      channelId: post.channel_id,
      channel: post.channel,
      categories: categories,
      category: categories[0] || '',
      actors: (post.post_actors || []).map((pa: any) => pa.actor?.name || '').filter(Boolean),
      actorProfiles: (post.post_actors || []).map((pa: any) => pa.actor).filter(Boolean),
      videoSources: videoSources,
      createdAt: post.created_at
    };

    return c.json({ success: true, data: formattedPost });
  } catch (error: any) {
    return c.json({ success: false, message: error.message || 'Failed to fetch post' }, 500);
  }
});

// GET /api/posts/:id/video - Video playback details & stream links
app.get('/api/posts/:id/video', async (c) => {
  try {
    const id = c.req.param('id');
    const supabase = getSupabase(c.env);

    let { data: post, error } = await supabase
      .from('posts')
      .select('id, title, thumbnail, post_video_sources(id, platform, video_id)')
      .eq('id', id)
      .maybeSingle();

    if (!post && id && id.length < 30) {
      const { data: fallbacks } = await supabase
        .from('posts')
        .select('id, title, thumbnail, post_video_sources(id, platform, video_id)')
        .ilike('id', `%${id}`)
        .limit(1);

      if (fallbacks && fallbacks.length > 0) {
        post = fallbacks[0];
        error = null;
      }
    }

    if (error || !post) {
      return c.json({ success: false, message: 'Post not found' }, 404);
    }

    const rawSources = post.post_video_sources || [];
    if (rawSources.length === 0) {
      return c.json({ success: false, message: 'No video sources found' }, 404);
    }

    const sources: VideoSource[] = rawSources.map((s: any, index: number) => ({
      platform: s.platform || 'streamtape',
      name: rawSources.length > 1 ? `Server ${index + 1}` : 'Streamtape',
      videoId: s.video_id,
      embedUrl: getEmbedUrl(s.video_id),
      downloadUrl: getDownloadUrl(s.video_id),
      thumbnail: getDefaultThumbnailUrl(s.video_id)
    }));

    return c.json({
      success: true,
      data: {
        postId: post.id,
        videoLink: sources[0] || null,
        sources: sources
      }
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message || 'Failed to fetch video' }, 500);
  }
});

// ── Channels Endpoints ──────────────────────────────────────────────────────
app.get('/api/channels', async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data: channels, error } = await supabase.from('channels').select('*').order('name', { ascending: true });
    if (error) throw error;
    return c.json({ success: true, data: channels || [] });
  } catch (error: any) {
    return c.json({ success: false, message: error.message || 'Failed to fetch channels' }, 500);
  }
});

app.get('/api/channels/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(c.req.query('perPage') || '12', 10)));
    const skip = (page - 1) * perPage;
    const supabase = getSupabase(c.env);

    let { data: channel } = await supabase.from('channels').select('*').eq('id', id).maybeSingle();
    if (!channel) {
      const { data: byName } = await supabase.from('channels').select('*').ilike('name', id).maybeSingle();
      if (byName) channel = byName;
    }

    if (!channel) return c.json({ success: false, message: 'Channel not found' }, 404);

    const { data: posts, count, error } = await supabase
      .from('posts')
      .select(`
        *,
        channel:channels(id, name, logo),
        post_actors(actor:actors(id, name)),
        post_video_sources(platform, video_id)
      `, { count: 'exact' })
      .eq('channel_id', channel.id)
      .order('created_at', { ascending: false })
      .range(skip, skip + perPage - 1);

    if (error) throw error;

    const formatted = await formatPostsRelations(posts || [], supabase);
    const total = count || 0;

    return c.json({
      success: true,
      data: {
        channel: channel,
        posts: formatted,
        pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) }
      }
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message || 'Failed to fetch channel' }, 500);
  }
});

// ── Actors Endpoints ────────────────────────────────────────────────────────
app.get('/api/actors', async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data: actors, error } = await supabase.from('actors').select('*').order('name', { ascending: true });
    if (error) throw error;
    return c.json({ success: true, data: actors || [] });
  } catch (error: any) {
    return c.json({ success: false, message: error.message || 'Failed to fetch actors' }, 500);
  }
});

app.get('/api/actors/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(c.req.query('perPage') || '12', 10)));
    const skip = (page - 1) * perPage;
    const supabase = getSupabase(c.env);

    let { data: actor } = await supabase.from('actors').select('*').eq('id', id).maybeSingle();
    if (!actor) {
      const { data: byName } = await supabase.from('actors').select('*').ilike('name', id).maybeSingle();
      if (byName) actor = byName;
    }

    if (!actor) return c.json({ success: false, message: 'Actor not found' }, 404);

    const { data: postActorRows } = await supabase.from('post_actors').select('post_id').eq('actor_id', actor.id);
    const linkedPostIds = (postActorRows || []).map((r: any) => r.post_id);

    let query = supabase
      .from('posts')
      .select(`
        *,
        channel:channels(id, name, logo),
        post_actors(actor:actors(id, name)),
        post_video_sources(platform, video_id)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (linkedPostIds.length > 0) {
      query = query.or(`id.in.(${linkedPostIds.join(',')}),title.ilike.%${actor.name}%`);
    } else {
      query = query.ilike('title', `%${actor.name}%`);
    }

    const { data: posts, count, error } = await query.range(skip, skip + perPage - 1);
    if (error) throw error;

    const formatted = await formatPostsRelations(posts || [], supabase);
    const total = count || 0;

    return c.json({
      success: true,
      data: {
        actor: actor,
        posts: formatted,
        pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) }
      }
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message || 'Failed to fetch actor' }, 500);
  }
});

// ── Categories Endpoints ────────────────────────────────────────────────────
app.get('/api/categories', async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data: categories, error } = await supabase.from('categories').select('*').order('name', { ascending: true });
    if (error) throw error;
    return c.json({ success: true, data: categories || [] });
  } catch (error: any) {
    return c.json({ success: false, message: error.message || 'Failed to fetch categories' }, 500);
  }
});

// ── Search Endpoints ────────────────────────────────────────────────────────
app.get('/api/search', async (c) => {
  try {
    const q = (c.req.query('q') || '').trim();
    const actor = c.req.query('actor');
    const channel = c.req.query('channel');
    const category = c.req.query('category');
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(c.req.query('perPage') || '12', 10)));
    const skip = (page - 1) * perPage;
    const supabase = getSupabase(c.env);

    let query = supabase
      .from('posts')
      .select(`
        *,
        channel:channels(id, name, logo),
        post_actors(actor:actors(id, name)),
        post_video_sources(platform, video_id)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (q) query = query.ilike('title', `%${q}%`);
    if (channel) query = query.ilike('channel.name', `%${channel}%`);

    const { data: posts, count, error } = await query.range(skip, skip + perPage - 1);
    if (error) throw error;

    const formatted = await formatPostsRelations(posts || [], supabase);
    const total = count || 0;

    return c.json({
      success: true,
      data: formatted,
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) }
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message || 'Search failed' }, 500);
  }
});

app.get('/api/search/quick', async (c) => {
  try {
    const q = (c.req.query('q') || '').trim();
    if (!q) return c.json({ success: true, videos: [], channels: [], actors: [] });
    const supabase = getSupabase(c.env);

    const [postsRes, channelsRes, actorsRes] = await Promise.allSettled([
      supabase.from('posts').select('id, title, thumbnail, channel:channels(name)').ilike('title', `%${q}%`).limit(6),
      supabase.from('channels').select('id, name, logo').ilike('name', `%${q}%`).limit(4),
      supabase.from('actors').select('id, name, image').ilike('name', `%${q}%`).limit(4)
    ]);

    const rawPosts = postsRes.status === 'fulfilled' && postsRes.value.data ? postsRes.value.data : [];
    const channels = channelsRes.status === 'fulfilled' && channelsRes.value.data ? channelsRes.value.data : [];
    const actors = actorsRes.status === 'fulfilled' && actorsRes.value.data ? actorsRes.value.data : [];

    const videos = rawPosts.map((p: any) => ({
      id: p.id,
      title: p.title,
      thumbnail: p.thumbnail || '',
      channelName: p.channel?.name || '',
      categories: [],
      actors: [],
      videoSources: [],
      createdAt: ''
    }));

    return c.json({ success: true, videos, channels, actors });
  } catch (error: any) {
    return c.json({ success: false, message: error.message || 'Quick search failed' }, 500);
  }
});

// ── Admin Auth Endpoints ────────────────────────────────────────────────────
app.post('/api/admin/login', async (c) => {
  try {
    const body: any = await c.req.json().catch(() => ({}));
    const { username, password } = body;

    const expectedUser = c.env.ADMIN_USERNAME || 'admin';
    const expectedPass = c.env.ADMIN_PASSWORD || 'xonstream';
    const secret = c.env.ADMIN_SECRET || 'xonstream';

    if (username !== expectedUser || password !== expectedPass) {
      return c.json({ success: false, message: 'Invalid admin credentials' }, 401);
    }

    const token = await signJwt({ username, role: 'admin', exp: Math.floor(Date.now() / 1000) + 86400 * 7 }, secret);

    c.header('Set-Cookie', `admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
    return c.json({ success: true, token, message: 'Login successful' });
  } catch (error: any) {
    return c.json({ success: false, message: error.message || 'Login failed' }, 500);
  }
});

app.post('/api/admin/logout', (c) => {
  c.header('Set-Cookie', 'admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  return c.json({ success: true, message: 'Logged out' });
});

app.get('/api/admin/verify', adminAuthMiddleware, (c) => {
  return c.json({ success: true, authenticated: true });
});

// ── Admin Protected Endpoints ───────────────────────────────────────────────

app.get('/api/admin/stats', adminAuthMiddleware, async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const [p, ch, act, cat] = await Promise.all([
      supabase.from('posts').select('id', { count: 'exact', head: true }),
      supabase.from('channels').select('id', { count: 'exact', head: true }),
      supabase.from('actors').select('id', { count: 'exact', head: true }),
      supabase.from('categories').select('id', { count: 'exact', head: true })
    ]);

    return c.json({
      success: true,
      stats: {
        posts: p.count || 0,
        channels: ch.count || 0,
        actors: act.count || 0,
        categories: cat.count || 0
      }
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.get('/api/admin/posts', adminAuthMiddleware, async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        *,
        channel:channels(id, name, logo),
        post_actors(actor:actors(id, name)),
        post_video_sources(platform, video_id)
      `)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) throw error;

    const formatted = await formatPostsRelations(posts || [], supabase);
    return c.json({ success: true, data: formatted });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.post('/api/admin/posts', adminAuthMiddleware, async (c) => {
  try {
    const body: any = await c.req.json().catch(() => ({}));
    const { title, description, thumbnail, channelId, categoryIds, categoryId, actorNames, actors, videoSources } = body;

    if (!title || !title.trim()) {
      return c.json({ success: false, message: 'Title is required' }, 400);
    }

    const supabase = getSupabase(c.env);
    const firstCatId = categoryIds && categoryIds.length > 0 ? categoryIds[0] : (categoryId || null);

    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        title: stripVideoExtensions(title),
        description: cleanDescription(description),
        thumbnail: (thumbnail && thumbnail.trim()) || '',
        channel_id: channelId || null,
        category_id: firstCatId
      })
      .select()
      .single();

    if (error) throw error;

    // Categories
    const allCatIds = Array.isArray(categoryIds) && categoryIds.length > 0 ? categoryIds : (categoryId ? [categoryId] : []);
    if (allCatIds.length > 0) {
      const catInserts = allCatIds.filter(Boolean).map((cid: string) => ({ post_id: post.id, category_id: cid }));
      if (catInserts.length > 0) await supabase.from('post_categories').insert(catInserts);
    }

    // Actors
    const actorsList = actorNames || actors || [];
    if (Array.isArray(actorsList) && actorsList.length > 0) {
      for (const act of actorsList) {
        if (!act || !String(act).trim()) continue;
        const name = String(act).trim();
        let actorId = '';
        const { data: existAct } = await supabase.from('actors').select('id').ilike('name', name).maybeSingle();
        if (existAct) {
          actorId = existAct.id;
        } else {
          const { data: newAct } = await supabase.from('actors').insert({ name }).select('id').single();
          if (newAct) actorId = newAct.id;
        }
        if (actorId) {
          await supabase.from('post_actors').insert({ post_id: post.id, actor_id: actorId });
        }
      }
    }

    // Video sources
    if (Array.isArray(videoSources) && videoSources.length > 0) {
      const srcInserts = videoSources.filter((s: any) => s.videoId || s.video_id).map((s: any) => ({
        post_id: post.id,
        platform: s.platform || 'streamtape',
        video_id: s.videoId || s.video_id
      }));
      if (srcInserts.length > 0) await supabase.from('post_video_sources').insert(srcInserts);
    }

    return c.json({ success: true, data: post });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.put('/api/admin/posts/:id', adminAuthMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const body: any = await c.req.json().catch(() => ({}));
    const supabase = getSupabase(c.env);

    const updateFields: Record<string, any> = {};
    if (body.title !== undefined) updateFields.title = stripVideoExtensions(body.title);
    if (body.description !== undefined) updateFields.description = cleanDescription(body.description);
    if (body.thumbnail !== undefined) updateFields.thumbnail = (body.thumbnail && body.thumbnail.trim()) || '';
    if (body.channelId !== undefined || body.channel !== undefined) {
      updateFields.channel_id = body.channelId || body.channel || null;
    }
    if (body.categoryIds && body.categoryIds.length > 0) {
      updateFields.category_id = body.categoryIds[0];
    } else if (body.categoryId !== undefined) {
      updateFields.category_id = body.categoryId || null;
    }

    const { data: post, error } = await supabase.from('posts').update(updateFields).eq('id', id).select().single();
    if (error) throw error;

    // Update categories
    if (body.categoryIds !== undefined) {
      await supabase.from('post_categories').delete().eq('post_id', id);
      if (Array.isArray(body.categoryIds) && body.categoryIds.length > 0) {
        const catInserts = body.categoryIds.filter(Boolean).map((cid: string) => ({ post_id: id, category_id: cid }));
        if (catInserts.length > 0) await supabase.from('post_categories').insert(catInserts);
      }
    }

    // Update actors
    const actorsList = body.actorNames || body.actors;
    if (actorsList !== undefined) {
      await supabase.from('post_actors').delete().eq('post_id', id);
      if (Array.isArray(actorsList) && actorsList.length > 0) {
        for (const act of actorsList) {
          if (!act || !String(act).trim()) continue;
          const name = String(act).trim();
          let actorId = '';
          const { data: existAct } = await supabase.from('actors').select('id').ilike('name', name).maybeSingle();
          if (existAct) {
            actorId = existAct.id;
          } else {
            const { data: newAct } = await supabase.from('actors').insert({ name }).select('id').single();
            if (newAct) actorId = newAct.id;
          }
          if (actorId) {
            await supabase.from('post_actors').insert({ post_id: id, actor_id: actorId });
          }
        }
      }
    }

    // Update video sources
    if (Array.isArray(body.videoSources)) {
      await supabase.from('post_video_sources').delete().eq('post_id', id);
      const srcInserts = body.videoSources.filter((s: any) => s.videoId || s.video_id).map((s: any) => ({
        post_id: id,
        platform: s.platform || 'streamtape',
        video_id: s.videoId || s.video_id
      }));
      if (srcInserts.length > 0) await supabase.from('post_video_sources').insert(srcInserts);
    }

    return c.json({ success: true, data: post });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.delete('/api/admin/posts/:id', adminAuthMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const supabase = getSupabase(c.env);
    await supabase.from('post_categories').delete().eq('post_id', id);
    await supabase.from('post_actors').delete().eq('post_id', id);
    await supabase.from('post_video_sources').delete().eq('post_id', id);
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) throw error;
    return c.json({ success: true, message: 'Post deleted' });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.post('/api/admin/posts/bulk-delete', adminAuthMiddleware, async (c) => {
  try {
    const body: any = await c.req.json().catch(() => ({}));
    const { postIds } = body;
    if (!Array.isArray(postIds) || postIds.length === 0) {
      return c.json({ success: false, message: 'postIds required' }, 400);
    }
    const supabase = getSupabase(c.env);
    await supabase.from('post_categories').delete().in('post_id', postIds);
    await supabase.from('post_actors').delete().in('post_id', postIds);
    await supabase.from('post_video_sources').delete().in('post_id', postIds);
    const { error } = await supabase.from('posts').delete().in('id', postIds);
    if (error) throw error;
    return c.json({ success: true, message: `Deleted ${postIds.length} posts` });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.post('/api/admin/posts/bulk-edit', adminAuthMiddleware, async (c) => {
  try {
    const body: any = await c.req.json().catch(() => ({}));
    const { postIds, setChannel, setCategories } = body;
    if (!Array.isArray(postIds) || postIds.length === 0) {
      return c.json({ success: false, message: 'postIds required' }, 400);
    }
    const supabase = getSupabase(c.env);
    const updates: Record<string, any> = {};
    if (setChannel !== undefined) updates.channel_id = setChannel || null;
    if (setCategories && setCategories.length > 0) updates.category_id = setCategories[0];

    if (Object.keys(updates).length > 0) {
      await supabase.from('posts').update(updates).in('id', postIds);
    }

    if (setCategories && setCategories.length > 0) {
      for (const pid of postIds) {
        await supabase.from('post_categories').delete().eq('post_id', pid);
        const inserts = setCategories.map((cid: string) => ({ post_id: pid, category_id: cid }));
        await supabase.from('post_categories').insert(inserts);
      }
    }

    return c.json({ success: true, message: `Updated ${postIds.length} posts` });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// ── Admin Channels Endpoints ────────────────────────────────────────────────
app.get('/api/admin/channels', adminAuthMiddleware, async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data, error } = await supabase.from('channels').select('*').order('name', { ascending: true });
    if (error) throw error;
    return c.json({ success: true, data: data || [] });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.post('/api/admin/channels', adminAuthMiddleware, async (c) => {
  try {
    const body: any = await c.req.json().catch(() => ({}));
    const supabase = getSupabase(c.env);
    const { data, error } = await supabase.from('channels').insert(body).select().single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.put('/api/admin/channels/:id', adminAuthMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const body: any = await c.req.json().catch(() => ({}));
    const supabase = getSupabase(c.env);
    const { data, error } = await supabase.from('channels').update(body).eq('id', id).select().single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.delete('/api/admin/channels/:id', adminAuthMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const supabase = getSupabase(c.env);
    await supabase.from('posts').update({ channel_id: null }).eq('channel_id', id);
    const { error } = await supabase.from('channels').delete().eq('id', id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.post('/api/admin/channels/bulk-create', adminAuthMiddleware, async (c) => {
  try {
    const body: any = await c.req.json().catch(() => ({}));
    const { items, names } = body;
    const supabase = getSupabase(c.env);
    let channelRows: any[] = [];

    if (Array.isArray(items) && items.length > 0) {
      channelRows = items.map((i: any) => ({
        name: String(i.name || '').trim(),
        handle: i.handle || (i.name ? i.name.toLowerCase().replace(/[^a-z0-9]/g, '') : ''),
        logo: i.logo || '',
        banner: i.banner || '',
        description: i.description || '',
        verified: i.verified ?? true
      })).filter(ch => ch.name);
    } else if (Array.isArray(names) && names.length > 0) {
      channelRows = names.map((n: string) => ({
        name: String(n || '').trim(),
        handle: String(n || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
        logo: '',
        banner: '',
        description: '',
        verified: true
      })).filter(ch => ch.name);
    }

    if (channelRows.length === 0) return c.json({ success: false, message: 'No valid channels to create' }, 400);

    const { data, error } = await supabase.from('channels').insert(channelRows).select();
    if (error) throw error;
    return c.json({ success: true, count: data?.length || 0, data });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.post('/api/admin/channels/bulk-delete', adminAuthMiddleware, async (c) => {
  try {
    const body: any = await c.req.json().catch(() => ({}));
    const { channelIds } = body;
    if (!Array.isArray(channelIds) || channelIds.length === 0) return c.json({ success: false, message: 'channelIds required' }, 400);
    const supabase = getSupabase(c.env);
    await supabase.from('posts').update({ channel_id: null }).in('channel_id', channelIds);
    const { error } = await supabase.from('channels').delete().in('id', channelIds);
    if (error) throw error;
    return c.json({ success: true, message: `Deleted ${channelIds.length} channels` });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// ── Admin Actors Endpoints ──────────────────────────────────────────────────
app.get('/api/admin/actors', adminAuthMiddleware, async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data, error } = await supabase.from('actors').select('*').order('name', { ascending: true });
    if (error) throw error;
    return c.json({ success: true, data: data || [] });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.post('/api/admin/actors', adminAuthMiddleware, async (c) => {
  try {
    const body: any = await c.req.json().catch(() => ({}));
    const supabase = getSupabase(c.env);
    const { data, error } = await supabase.from('actors').insert(body).select().single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.put('/api/admin/actors/:id', adminAuthMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const body: any = await c.req.json().catch(() => ({}));
    const supabase = getSupabase(c.env);
    const { data, error } = await supabase.from('actors').update({
      name: body.name,
      image: body.image || '',
      bio: body.bio || ''
    }).eq('id', id).select().single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.delete('/api/admin/actors/:id', adminAuthMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const supabase = getSupabase(c.env);
    await supabase.from('post_actors').delete().eq('actor_id', id);
    const { error } = await supabase.from('actors').delete().eq('id', id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.post('/api/admin/actors/bulk-create', adminAuthMiddleware, async (c) => {
  try {
    const body: any = await c.req.json().catch(() => ({}));
    const { names, items } = body;
    const supabase = getSupabase(c.env);
    let actorRows: any[] = [];

    if (Array.isArray(items) && items.length > 0) {
      actorRows = items.map((i: any) => ({
        name: String(i.name || '').trim(),
        image: i.image || '',
        bio: i.bio || ''
      })).filter(a => a.name);
    } else if (Array.isArray(names) && names.length > 0) {
      actorRows = names.map((n: string) => ({
        name: String(n || '').trim(),
        image: '',
        bio: ''
      })).filter(a => a.name);
    }

    if (actorRows.length === 0) return c.json({ success: false, message: 'No valid actors to create' }, 400);

    const { data, error } = await supabase.from('actors').insert(actorRows).select();
    if (error) throw error;
    return c.json({ success: true, count: data?.length || 0, data });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.post('/api/admin/actors/bulk-delete', adminAuthMiddleware, async (c) => {
  try {
    const body: any = await c.req.json().catch(() => ({}));
    const { actorIds } = body;
    if (!Array.isArray(actorIds) || actorIds.length === 0) return c.json({ success: false, message: 'actorIds required' }, 400);
    const supabase = getSupabase(c.env);
    await supabase.from('post_actors').delete().in('actor_id', actorIds);
    const { error } = await supabase.from('actors').delete().in('id', actorIds);
    if (error) throw error;
    return c.json({ success: true, message: `Deleted ${actorIds.length} actors` });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// ── Admin Categories Endpoints ──────────────────────────────────────────────
app.get('/api/admin/categories', adminAuthMiddleware, async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data, error } = await supabase.from('categories').select('*').order('name', { ascending: true });
    if (error) throw error;
    return c.json({ success: true, data: data || [] });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.post('/api/admin/categories', adminAuthMiddleware, async (c) => {
  try {
    const body: any = await c.req.json().catch(() => ({}));
    const supabase = getSupabase(c.env);
    const { data, error } = await supabase.from('categories').insert(body).select().single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.put('/api/admin/categories/:id', adminAuthMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const body: any = await c.req.json().catch(() => ({}));
    const supabase = getSupabase(c.env);
    const { data, error } = await supabase.from('categories').update(body).eq('id', id).select().single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.delete('/api/admin/categories/:id', adminAuthMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const supabase = getSupabase(c.env);
    await supabase.from('post_categories').delete().eq('category_id', id);
    await supabase.from('posts').update({ category_id: null }).eq('category_id', id);
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.post('/api/admin/categories/bulk-create', adminAuthMiddleware, async (c) => {
  try {
    const body: any = await c.req.json().catch(() => ({}));
    const { names } = body;
    if (!Array.isArray(names) || names.length === 0) return c.json({ success: false, message: 'names array required' }, 400);
    const supabase = getSupabase(c.env);
    const catRows = names.map((n: string) => ({ name: String(n || '').trim() })).filter(c => c.name);
    const { data, error } = await supabase.from('categories').insert(catRows).select();
    if (error) throw error;
    return c.json({ success: true, count: data?.length || 0, data });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.post('/api/admin/categories/bulk-delete', adminAuthMiddleware, async (c) => {
  try {
    const body: any = await c.req.json().catch(() => ({}));
    const { categoryIds } = body;
    if (!Array.isArray(categoryIds) || categoryIds.length === 0) return c.json({ success: false, message: 'categoryIds required' }, 400);
    const supabase = getSupabase(c.env);
    await supabase.from('post_categories').delete().in('category_id', categoryIds);
    await supabase.from('posts').update({ category_id: null }).in('category_id', categoryIds);
    const { error } = await supabase.from('categories').delete().in('id', categoryIds);
    if (error) throw error;
    return c.json({ success: true, message: `Deleted ${categoryIds.length} categories` });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// ── Admin Player Settings ───────────────────────────────────────────────────
app.get('/api/admin/settings/player', adminAuthMiddleware, async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data } = await supabase.from('site_settings').select('*').eq('key', 'player_settings').maybeSingle();
    if (data && data.value) {
      return c.json({ success: true, data: data.value });
    }
    return c.json({
      success: true,
      data: { autoPlay: true, defaultServer: 'SERVER_01', updatedAt: new Date().toISOString() }
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.put('/api/admin/settings/player', adminAuthMiddleware, async (c) => {
  try {
    const body: any = await c.req.json().catch(() => ({}));
    const supabase = getSupabase(c.env);
    const newSettings = {
      autoPlay: body.autoPlay ?? true,
      defaultServer: body.defaultServer || 'SERVER_01',
      updatedAt: new Date().toISOString()
    };

    const { error } = await supabase.from('site_settings').upsert({
      key: 'player_settings',
      value: newSettings,
      updated_at: new Date().toISOString()
    });

    if (error) throw error;
    return c.json({ success: true, data: newSettings, message: 'Player settings updated' });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// ── Streamtape Cloud On-Demand & Bulk Import ────────────────────────────────
app.get('/api/admin/streamtape/videos', adminAuthMiddleware, async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const [streamtapeFiles, existingSourcesRes] = await Promise.all([
      getAllStreamtapeFiles('', c.env),
      supabase.from('post_video_sources').select('video_id, post_id').eq('platform', 'streamtape')
    ]);

    const existingVideoIds = new Set(
      (existingSourcesRes.data || []).map((s: any) => s.video_id).filter(Boolean)
    );

    const unimported = streamtapeFiles.filter((f: any) => f.id && !existingVideoIds.has(f.id));

    const videoIdsToFetch = unimported.map((f: any) => f.id);
    const thumbMap = await getBatchThumbnails(videoIdsToFetch, c.env);

    const items = unimported.map((f: any) => ({
      videoId: f.id,
      name: f.name || 'Untitled Video',
      title: stripVideoExtensions(f.name || 'Untitled Video'),
      size: f.size || 0,
      thumbnail: thumbMap[f.id] || getDefaultThumbnailUrl(f.id),
      embedUrl: getEmbedUrl(f.id),
      alreadyExists: false,
      existingPostId: null
    }));

    return c.json({
      success: true,
      count: items.length,
      data: items,
      message: `Found ${items.length} un-imported videos on Streamtape Cloud`
    });
  } catch (error: any) {
    return c.json({ success: false, count: 0, data: [], message: error.message || 'Streamtape fetch error' }, 500);
  }
});

app.post('/api/admin/streamtape/bulk-create', adminAuthMiddleware, async (c) => {
  try {
    const body: any = await c.req.json().catch(() => ({}));
    const { videos, channelId, channelName, categoryIds, actorNames } = body;

    if (!Array.isArray(videos) || videos.length === 0) {
      return c.json({ success: false, message: 'videos array required' }, 400);
    }

    const supabase = getSupabase(c.env);
    let resolvedChannelId = channelId || null;

    if (!resolvedChannelId && channelName && channelName.trim()) {
      const { data: existCh } = await supabase.from('channels').select('id').ilike('name', channelName.trim()).maybeSingle();
      if (existCh) {
        resolvedChannelId = existCh.id;
      } else {
        const { data: newCh } = await supabase.from('channels').insert({
          name: channelName.trim(),
          handle: channelName.trim().toLowerCase().replace(/[^a-z0-9]/g, ''),
          verified: true
        }).select('id').single();
        if (newCh) resolvedChannelId = newCh.id;
      }
    }

    // Resolve actors
    const resolvedActorIds: string[] = [];
    if (Array.isArray(actorNames) && actorNames.length > 0) {
      for (const aName of actorNames) {
        if (!aName || !aName.trim()) continue;
        const { data: existAct } = await supabase.from('actors').select('id').ilike('name', aName.trim()).maybeSingle();
        if (existAct) {
          resolvedActorIds.push(existAct.id);
        } else {
          const { data: newAct } = await supabase.from('actors').insert({ name: aName.trim() }).select('id').single();
          if (newAct) resolvedActorIds.push(newAct.id);
        }
      }
    }

    const videoIdsToFetch = videos.filter((v: any) => v.videoId && (!v.thumbnail || v.thumbnail.endsWith('/thumb.jpg'))).map((v: any) => v.videoId);
    const thumbMap = await getBatchThumbnails(videoIdsToFetch, c.env);

    let createdCount = 0;
    let skippedCount = 0;

    for (const item of videos) {
      if (!item.videoId) continue;
      const postTitle = stripVideoExtensions(item.title || item.name || 'Untitled Video');
      const postThumb = (item.thumbnail && !item.thumbnail.endsWith('/thumb.jpg'))
        ? item.thumbnail
        : (thumbMap[item.videoId] || `https://thumb.tapecontent.net/thumb/${item.videoId}/thumb.jpg`);

      try {
        const { data: newPost, error: postErr } = await supabase
          .from('posts')
          .insert({
            title: postTitle,
            description: cleanDescription(item.description),
            thumbnail: postThumb || '',
            channel_id: resolvedChannelId
          })
          .select()
          .single();

        if (postErr || !newPost) {
          skippedCount++;
          continue;
        }

        // Link video source
        await supabase.from('post_video_sources').insert({
          post_id: newPost.id,
          platform: 'streamtape',
          video_id: item.videoId
        });

        // Link categories
        if (Array.isArray(categoryIds) && categoryIds.length > 0) {
          const catInserts = categoryIds.filter(Boolean).map((cid: string) => ({ post_id: newPost.id, category_id: cid }));
          if (catInserts.length > 0) await supabase.from('post_categories').insert(catInserts);
        }

        // Link actors
        if (resolvedActorIds.length > 0) {
          const actInserts = resolvedActorIds.map(aid => ({ post_id: newPost.id, actor_id: aid }));
          await supabase.from('post_actors').insert(actInserts);
        }

        createdCount++;
      } catch {
        skippedCount++;
      }
    }

    return c.json({
      success: true,
      createdCount,
      skippedCount,
      message: `Successfully created ${createdCount} posts (${skippedCount} skipped)`
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message || 'Bulk create failed' }, 500);
  }
});

// ── Database Maintenance ────────────────────────────────────────────────────
app.post('/api/admin/database/optimize', adminAuthMiddleware, async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data: posts, error } = await supabase.from('posts').select('id, title, thumbnail, post_video_sources(video_id)');
    if (error) throw error;

    let thumbsRestored = 0;
    let titlesCleaned = 0;
    let totalPostsUpdated = 0;

    for (const p of posts || []) {
      const primaryVideoId = p.post_video_sources?.[0]?.video_id;
      const cleanedTitle = stripVideoExtensions(p.title);
      const updates: Record<string, any> = {};

      if ((!p.thumbnail || !p.thumbnail.trim()) && primaryVideoId) {
        try {
          const thumbMap = await getBatchThumbnails([primaryVideoId], c.env);
          if (thumbMap[primaryVideoId]) {
            updates.thumbnail = thumbMap[primaryVideoId];
            thumbsRestored++;
          }
        } catch {
          // fallback
        }
      }

      if (p.title !== cleanedTitle) {
        updates.title = cleanedTitle;
        titlesCleaned++;
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('posts').update(updates).eq('id', p.id);
        totalPostsUpdated++;
      }
    }

    return c.json({
      success: true,
      message: `Database maintenance complete! Restored ${thumbsRestored} thumbnails and cleaned ${titlesCleaned} titles.`,
      stats: {
        totalPostsScanned: posts?.length || 0,
        totalPostsCompacted: totalPostsUpdated,
        thumbsCompacted: thumbsRestored,
        descsCompacted: 0,
        titlesCleaned,
        estimatedSpaceSaved: '100% Healthy'
      }
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

export default app;
