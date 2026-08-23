const supabase = require('../config/supabase');
const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');

// In-memory index cache
let searchIndex = null;
let lastIndexBuild = 0;
const INDEX_TTL_MS = 60 * 1000; // 1 minute auto refresh

// Build or return cached search index
async function getSearchIndex(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && searchIndex && (now - lastIndexBuild < INDEX_TTL_MS)) {
    return searchIndex;
  }

  try {
    const [postsRes, pcRes, paRes, vsRes, chRes, actRes] = await Promise.allSettled([
      supabase.from('posts').select('id, title, description, thumbnail, channel_id, created_at').order('created_at', { ascending: false }),
      supabase.from('post_categories').select('post_id, category:categories(id, name)'),
      supabase.from('post_actors').select('post_id, actor:actors(id, name)'),
      supabase.from('post_video_sources').select('post_id, platform, video_id'),
      supabase.from('channels').select('id, name, logo'),
      supabase.from('actors').select('id, name, image')
    ]);

    const rawPosts = postsRes.status === 'fulfilled' && postsRes.value.data ? postsRes.value.data : [];
    const rawPC = pcRes.status === 'fulfilled' && pcRes.value.data ? pcRes.value.data : [];
    const rawPA = paRes.status === 'fulfilled' && paRes.value.data ? paRes.value.data : [];
    const rawVS = vsRes.status === 'fulfilled' && vsRes.value.data ? vsRes.value.data : [];
    const channels = chRes.status === 'fulfilled' && chRes.value.data ? chRes.value.data : [];
    const actors = actRes.status === 'fulfilled' && actRes.value.data ? actRes.value.data : [];

    const channelMap = new Map();
    channels.forEach(c => channelMap.set(c.id, c));

    const categoryMap = new Map();
    rawPC.forEach(item => {
      if (!categoryMap.has(item.post_id)) categoryMap.set(item.post_id, []);
      if (item.category?.name) categoryMap.get(item.post_id).push(item.category.name);
    });

    const actorMap = new Map();
    rawPA.forEach(item => {
      if (!actorMap.has(item.post_id)) actorMap.set(item.post_id, []);
      if (item.actor?.name) actorMap.get(item.post_id).push(item.actor.name);
    });

    const videoSourceMap = new Map();
    rawVS.forEach(item => {
      if (!videoSourceMap.has(item.post_id)) videoSourceMap.set(item.post_id, []);
      videoSourceMap.get(item.post_id).push({
        platform: item.platform || 'streamtape',
        videoId: item.video_id,
        embedUrl: `https://streamtape.com/e/${item.video_id}`,
        downloadUrl: `https://streamtape.com/v/${item.video_id}`,
        thumbnail: `https://thumb.tapecontent.net/thumb/${item.video_id}/thumb.jpg`
      });
    });

    const indexedPosts = rawPosts.map(p => {
      const ch = channelMap.get(p.channel_id);
      const cats = categoryMap.get(p.id) || [];
      const acts = actorMap.get(p.id) || [];
      const vSources = videoSourceMap.get(p.id) || [];

      return {
        id: p.id,
        title: p.title || '',
        description: p.description || '',
        thumbnail: p.thumbnail || (vSources[0] ? `https://thumb.tapecontent.net/thumb/${vSources[0].videoId}/thumb.jpg` : ''),
        channelId: p.channel_id,
        channelName: ch?.name || '',
        channelLogo: ch?.logo || '',
        categories: cats,
        category: cats[0] || '',
        actors: acts,
        videoSources: vSources,
        createdAt: p.created_at,
        // Searchable concatenated lower-case string
        _searchStr: `${p.title} ${p.description} ${ch?.name || ''} ${cats.join(' ')} ${acts.join(' ')}`.toLowerCase()
      };
    });

    searchIndex = {
      posts: indexedPosts,
      channels,
      actors,
      builtAt: now
    };
    lastIndexBuild = now;
    return searchIndex;
  } catch (err) {
    logger.error('Error building in-memory search index:', err);
    if (searchIndex) return searchIndex;
    return { posts: [], channels: [], actors: [], builtAt: 0 };
  }
}

module.exports = async (fastify, opts) => {
  // ── Instant Quick Search Dropdown / Autocomplete (< 2ms) ───────────────────
  fastify.get('/api/search/quick', async (request, reply) => {
    try {
      const q = (request.query.q || '').trim().toLowerCase();
      if (!q || q.length < 1) {
        return reply.send({ success: true, videos: [], channels: [], actors: [] });
      }

      const index = await getSearchIndex();
      const words = q.split(/\s+/).filter(Boolean);

      // Match videos
      const matchedVideos = [];
      for (const post of index.posts) {
        let score = 0;
        const lowerTitle = post.title.toLowerCase();
        if (lowerTitle.startsWith(q)) score += 100;
        else if (lowerTitle.includes(q)) score += 50;

        const allWordsMatch = words.every(w => post._searchStr.includes(w));
        if (allWordsMatch) score += 30;

        if (score > 0) {
          matchedVideos.push({ post, score });
        }
      }
      matchedVideos.sort((a, b) => b.score - a.score);

      // Match channels
      const matchedChannels = index.channels
        .filter(c => c.name && c.name.toLowerCase().includes(q))
        .slice(0, 4);

      // Match actors
      const matchedActors = index.actors
        .filter(a => a.name && a.name.toLowerCase().includes(q))
        .slice(0, 4);

      return reply.send({
        success: true,
        videos: matchedVideos.slice(0, 6).map(m => m.post),
        channels: matchedChannels,
        actors: matchedActors
      });
    } catch (err) {
      logger.error('Quick search error:', err);
      return reply.status(500).send({ success: false, message: 'Quick search failed' });
    }
  });

  // ── Full Search Endpoint (< 5ms with Pagination & Filters) ─────────────────
  fastify.get('/api/search', async (request, reply) => {
    try {
      const { q: query, actor, channel, category } = request.query;
      const page = Math.max(1, parseInt(request.query.page, 10) || 1);
      const perPage = Math.min(100, Math.max(1, parseInt(request.query.perPage, 10) || 12));

      const normalizedQuery = query ? query.replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase() : '';
      const words = normalizedQuery.split(/\s+/).filter(Boolean);

      const cacheKey = `search:${normalizedQuery}:${actor || ''}:${channel || ''}:${category || ''}:${page}:${perPage}`;
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return reply.send(cached);
      }

      const index = await getSearchIndex();
      let matched = [];

      for (const post of index.posts) {
        // Channel filter
        if (channel && (!post.channelName || post.channelName.toLowerCase() !== channel.toLowerCase())) {
          continue;
        }

        // Category filter
        if (category && (!post.categories.some(c => c.toLowerCase() === category.toLowerCase()))) {
          continue;
        }

        // Actor filter
        if (actor) {
          const actorLower = actor.toLowerCase();
          const hasInActors = post.actors.some(a => a.toLowerCase().includes(actorLower));
          const hasInTitle = post.title.toLowerCase().includes(actorLower);
          if (!hasInActors && !hasInTitle) {
            continue;
          }
        }

        // Text query matching & scoring
        let score = 1;
        if (words.length > 0) {
          const lowerTitle = post.title.toLowerCase();
          const lowerDesc = post.description.toLowerCase();
          const lowerChan = post.channelName.toLowerCase();

          if (lowerTitle === normalizedQuery) score += 200;
          else if (lowerTitle.startsWith(normalizedQuery)) score += 100;
          else if (lowerTitle.includes(normalizedQuery)) score += 60;

          // Word-by-word matches
          let wordsMatched = 0;
          for (const w of words) {
            if (lowerTitle.includes(w)) { score += 25; wordsMatched++; }
            else if (lowerChan.includes(w)) { score += 15; wordsMatched++; }
            else if (post.categories.some(c => c.toLowerCase().includes(w))) { score += 10; wordsMatched++; }
            else if (post.actors.some(a => a.toLowerCase().includes(w))) { score += 10; wordsMatched++; }
            else if (lowerDesc.includes(w)) { score += 5; wordsMatched++; }
          }

          if (wordsMatched === 0) continue;
        }

        matched.push({ post, score });
      }

      // Sort by score descending, then created_at descending
      matched.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime();
      });

      const total = matched.length;
      const skip = (page - 1) * perPage;
      const paginated = matched.slice(skip, skip + perPage).map(m => m.post);

      const result = {
        success: true,
        data: paginated,
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage) || 1
        }
      };

      cacheService.set(cacheKey, result, 60); // 1 minute cache
      return reply.send(result);
    } catch (error) {
      logger.error('Search route error:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to perform search'
      });
    }
  });
};
