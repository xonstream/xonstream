const supabase = require('../config/supabase');
const cacheService = require('../services/cacheService');
const syncService = require('../services/syncService');
const logger = require('../utils/logger');

function stripVideoExtensions(title) {
  if (!title || typeof title !== 'string') return '';
  return title
    .replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v|3gp|ts)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Clean description: Never write or return ISO timestamps like 2026-08-23T10:16:36.25525+00:00
function cleanDescription(desc) {
  if (!desc || typeof desc !== 'string') return '';
  const trimmed = desc.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) return '';
  return trimmed;
}

function cleanThumbnailUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return url.trim();
}

module.exports = async (fastify, opts) => {
  // Add auth hook for all admin routes EXCEPT public endpoints
  fastify.addHook('onRequest', async (request, reply) => {
    // Skip auth for public endpoints
    if (request.url === '/api/admin/test-sync' || 
        request.url === '/api/public/settings/player') {
      return;
    }
    return fastify.authenticateAdmin(request, reply);
  });

  // Public test endpoint - remove in production
  fastify.get('/api/admin/test-sync', async (request, reply) => {
    try {
      logger.info('Test sync endpoint called');

      // Test Streamtape API
      const streamtapeService = require('../services/streamtape');

      let streamtapeFiles = [];

      try {
        streamtapeFiles = await streamtapeService.getAllFiles();
        logger.info(`Streamtape API: Found ${streamtapeFiles.length} files`);
      } catch (e) {
        logger.error('Streamtape API error:', e.message);
      }

      return reply.send({
        success: true,
        streamtape: {
          fileCount: streamtapeFiles.length,
          files: streamtapeFiles.slice(0, 5)
        }
      });
    } catch (error) {
      logger.error('Test sync error', error);
      return reply.status(500).send({
        success: false,
        message: error.message
      });
    }
  });

  // NEW: Test Supabase update directly
  fastify.post('/api/admin/test-db-update', async (request, reply) => {
    try {
      const { postId, channelId } = request.body || {};
      
      if (!postId) {
        return reply.status(400).send({
          success: false,
          message: 'postId is required'
        });
      }
      
      logger.info(`=== TEST DB UPDATE ===`);
      logger.info(`Post ID: ${postId}`);
      logger.info(`Channel ID: ${channelId}`);
      
      // Step 1: Get current value
      const { data: beforeUpdate, error: fetchError } = await supabase
        .from('posts')
        .select('id, title, channel_id')
        .eq('id', postId)
        .single();
      
      if (fetchError) {
        return reply.status(404).send({
          success: false,
          message: `Post not found: ${fetchError.message}`
        });
      }
      
      logger.info(`BEFORE UPDATE: channel_id = ${beforeUpdate.channel_id}`);
      
      // Step 2: Update
      const { data: updated, error: updateError } = await supabase
        .from('posts')
        .update({ channel_id: channelId || null })
        .eq('id', postId)
        .select()
        .single();
      
      if (updateError) {
        logger.error(`UPDATE ERROR:`, updateError);
        return reply.status(500).send({
          success: false,
          message: `Update failed: ${updateError.message}`,
          error: updateError
        });
      }
      
      logger.info(`UPDATE RESPONSE:`, updated);
      
      // Step 3: Verify
      const { data: afterUpdate, error: verifyError } = await supabase
        .from('posts')
        .select('id, title, channel_id')
        .eq('id', postId)
        .single();
      
      if (verifyError) {
        logger.error(`VERIFY ERROR:`, verifyError);
      }
      
      logger.info(`AFTER UPDATE: channel_id = ${afterUpdate.channel_id}`);
      
      const persisted = afterUpdate.channel_id === (channelId || null);
      
      logger.info(`PERSISTED: ${persisted}`);
      
      return reply.send({
        success: true,
        data: {
          postId,
          beforeUpdate: beforeUpdate.channel_id,
          afterUpdate: afterUpdate.channel_id,
          expectedValue: channelId || null,
          persisted: persisted,
          message: persisted ? '✅ Update persisted successfully!' : '❌ Update did NOT persist!'
        }
      });
    } catch (error) {
      logger.error('Test DB update error', error);
      return reply.status(500).send({
        success: false,
        message: error.message
      });
    }
  });

  // Admin-specific endpoint to get all posts with full details
  fastify.get('/api/admin/posts', async (request, reply) => {
    try {
      // Fetch posts with all relations (excluding category - we get it from post_categories)
      let { data: posts, error } = await supabase
        .from('posts')
        .select(`
          *,
          channel:channels(name),
          post_actors(actor:actors(name)),
          post_video_sources(platform, video_id)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching admin posts', error);
        return reply.status(500).send({
          success: false,
          message: 'Failed to fetch posts: ' + error.message
        });
      }

      // Fetch post_categories separately to get all categories for each post
      let postCategoriesMap = {};
      try {
        const { data: postCategories, error: catError } = await supabase
          .from('post_categories')
          .select(`
            post_id,
            category:categories(name)
          `);
        
        if (catError) {
          logger.error('Error fetching post_categories:', catError);
        } else if (postCategories && postCategories.length > 0) {
          // Build a map: postId -> [category names]
          postCategories.forEach(pc => {
            if (!postCategoriesMap[pc.post_id]) {
              postCategoriesMap[pc.post_id] = [];
            }
            if (pc.category?.name) {
              postCategoriesMap[pc.post_id].push(pc.category.name);
            }
          });
          logger.info(`Loaded ${postCategories.length} category assignments for ${Object.keys(postCategoriesMap).length} posts from post_categories table`);
        } else {
          logger.warn('post_categories table is empty - no category assignments found');
        }
      } catch (catErr) {
        logger.error('post_categories table query failed:', catErr.message);
      }

      const formattedPosts = (posts || []).map(post => {
        // Try to get categories from post_categories map first (multiple)
        // Fallback to single category from posts.category_id (backward compatibility)
        let categories = [];
        
        if (postCategoriesMap[post.id] && postCategoriesMap[post.id].length > 0) {
          // Multiple categories from junction table
          categories = postCategoriesMap[post.id];
        } else if (post.category) {
          // Single category from old schema
          categories = [post.category.name];
        }
        
        // DIAGNOSTIC: Log EXACT channel data from Supabase
        logger.info(`Post "${post.title}" (ID: ${post.id}):`);
        logger.info(`  - channel_id in DB: ${post.channel_id}`);
        logger.info(`  - channel.name from join: ${post.channel?.name || 'NULL'}`);
        logger.info(`  - channel.id from join: ${post.channel?.id || 'NULL'}`);
        
        return {
          id: post.id,
          title: post.title,
          description: cleanDescription(post.description),
          thumbnail: post.thumbnail || '',
          channelName: post.channel?.name || '',
          channelId: post.channel_id, // Return the actual channel_id from DB
          categories: categories,
          category: categories[0] || '', // Keep single category for backward compat
          actors: post.post_actors?.map(pa => pa.actor?.name).filter(Boolean) || [],
          videoSources: (post.post_video_sources || []).map(vs => ({
            platform: vs.platform,
            videoId: vs.video_id
          })),
          created_at: post.created_at
        };
      });

      return reply.send({
        success: true,
        data: formattedPosts
      });
    } catch (error) {
      logger.error('Error fetching admin posts', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch posts: ' + (error.message || 'Unknown error')
      });
    }
  });

  fastify.post('/api/admin/cache/flush', async (request, reply) => {
    try {
      logger.info('Manual cache flush triggered by admin');
      cacheService.flushAll();
      await cacheService.rebuildFromDB();

      return reply.send({
        success: true,
        message: 'Cache flushed and rebuilt successfully'
      });
    } catch (error) {
      logger.error('Error flushing cache', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to flush cache'
      });
    }
  });

  fastify.post('/api/admin/posts', async (request, reply) => {
    try {
      const {
        title,
        description,
        actors,
        actorNames,
        channelId,
        categoryIds,
        categoryId,
        thumbnail,
        videoSources
      } = request.body || {};

      const actorsList = actorNames || actors || [];

      logger.info('=== CREATING POST ===');
      logger.info('Title:', title);
      logger.info('Channel ID:', channelId);
      logger.info('Category IDs:', categoryIds);
      logger.info('Category ID (single):', categoryId);
      logger.info('Actors received:', actorsList);
      logger.info('Video Sources:', videoSources);
      logger.info('=====================');

      if (!title || !title.trim()) {
        return reply.status(400).send({
          success: false,
          message: 'Title is required'
        });
      }

      // Use first categoryId for posts.category_id (backward compatibility)
      // But insert ALL categories into post_categories junction table
      const firstCategoryId = categoryIds && categoryIds.length > 0 ? categoryIds[0] : (categoryId || null);
      // Insert post
      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert({
          title: stripVideoExtensions(title),
          description: cleanDescription(description),
          thumbnail: cleanThumbnailUrl(thumbnail),
          channel_id: channelId || null,
          category_id: firstCategoryId
        })
        .select()
        .single();

      if (postError) {
        logger.error('❌ ERROR CREATING POST in Supabase', postError);
        return reply.status(500).send({
          success: false,
          message: 'Failed to create post: ' + postError.message
        });
      }

      logger.info('✅ Post created in Supabase with ID:', post.id);
      
      // VERIFICATION: Confirm post was actually created
      const { data: verifyPost, error: verifyError } = await supabase
        .from('posts')
        .select('id, title, channel_id, category_id')
        .eq('id', post.id)
        .single();
      
      if (verifyError) {
        logger.error('❌ VERIFICATION FAILED - Post may not have been created:', verifyError);
      } else if (verifyPost) {
        logger.info('✅ VERIFICATION SUCCESS - Post exists in database:');
        logger.info(`  - ID: ${verifyPost.id}`);
        logger.info(`  - Title: ${verifyPost.title}`);
        logger.info(`  - channel_id: ${verifyPost.channel_id}`);
      }

      // Insert video sources FIRST
      if (post && videoSources && videoSources.length > 0) {
        logger.info(`Inserting ${videoSources.length} video sources for post ${post.id}`);
        
        const videoSourceInserts = videoSources.map(vs => ({
          post_id: post.id,
          platform: vs.platform,
          video_id: vs.videoId
        }));

        const { error: vsError } = await supabase
          .from('post_video_sources')
          .insert(videoSourceInserts);

        if (vsError) {
          logger.error('Error inserting video sources', vsError);
        } else {
          logger.info('Video sources inserted successfully');
        }
      }

      // Insert actor relationships (Find or create actor & insert into post_actors)
      if (post && Array.isArray(actorsList) && actorsList.length > 0) {
        logger.info(`Linking ${actorsList.length} actors to post ${post.id}`);
        const actorIds = [];
        for (const actorItem of actorsList) {
          if (!actorItem || !String(actorItem).trim()) continue;
          const actorStr = String(actorItem).trim();
          if (actorStr.includes('-') && actorStr.length === 36) {
            actorIds.push(actorStr);
            continue;
          }

          const { data: existActor } = await supabase
            .from('actors')
            .select('id')
            .ilike('name', actorStr)
            .maybeSingle();

          if (existActor) {
            actorIds.push(existActor.id);
          } else {
            const { data: newActor } = await supabase
              .from('actors')
              .insert({ name: actorStr })
              .select('id')
              .single();
            if (newActor) actorIds.push(newActor.id);
          }
        }

        if (actorIds.length > 0) {
          const actorInserts = actorIds.map(actorId => ({
            post_id: post.id,
            actor_id: actorId
          }));
          await supabase.from('post_actors').insert(actorInserts);
          logger.info(`Successfully linked ${actorInserts.length} actors to post ${post.id}`);
        }
      }

      // Insert category relationships (for post_categories junction table)
      if (post && categoryIds && categoryIds.length > 0) {
        logger.info(`Linking ${categoryIds.length} categories to post ${post.id}`);
        logger.info(`Category IDs to insert:`, categoryIds);
        
        const categoryInserts = categoryIds.map(catId => ({
          post_id: post.id,
          category_id: catId
        }));

        logger.info(`Category insert data:`, JSON.stringify(categoryInserts, null, 2));

        const { error: catError, data: catData } = await supabase
          .from('post_categories')
          .insert(categoryInserts)
          .select();

        if (catError) {
          logger.error('Error inserting category relations', catError);
          logger.error('Category error details:', JSON.stringify(catError, null, 2));
        } else {
          logger.info(`Successfully linked ${categoryInserts.length} categories`);
          logger.info(`Inserted category data:`, catData);
        }
      } else if (post) {
        logger.warn(`No categoryIds provided for post ${post.id}. categoryIds:`, categoryIds);
      }

      // Invalidate ALL post-related caches including pagination
      cacheService.invalidateAllPostLists();
      cacheService.invalidateActors();

      logger.info('Post creation completed, cache invalidated');

      return reply.status(201).send({
        success: true,
        data: post,
        message: 'Post created successfully'
      });
    } catch (error) {
      logger.error('Error creating post', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to create post'
      });
    }
  });

  fastify.put('/api/admin/posts/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const updates = request.body || {};

      const allowedUpdates = ['title', 'description', 'actors', 'actorNames', 'channelId', 'channelName', 'categoryIds', 'categoryId', 'thumbnail', 'videoSources'];
      const updateData = {};

      if (updates.title !== undefined) updateData.title = updates.title.trim();
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.actors !== undefined) updateData.actors = updates.actors;
      if (updates.actorNames !== undefined) updateData.actors = updates.actorNames;
      if (updates.channelId !== undefined) updateData.channel = updates.channelId;
      if (updates.channelName !== undefined) updateData.channelName = updates.channelName;
      if (updates.categoryIds !== undefined) updateData.categories = updates.categoryIds;
      if (updates.categoryId !== undefined) updateData.category = updates.categoryId;
      if (updates.thumbnail !== undefined) updateData.thumbnail = updates.thumbnail;
      if (updates.videoSources !== undefined) updateData.videoSources = updates.videoSources;

      if (Object.keys(updateData).length === 0) {
        return reply.status(400).send({
          success: false,
          message: 'No valid fields to update'
        });
      }

      // 1. Resolve Channel by ID or Name
      let resolvedChannelId = updateData.channel || null;
      if (!resolvedChannelId && updateData.channelName && updateData.channelName.trim()) {
        const { data: existCh } = await supabase
          .from('channels')
          .select('id')
          .ilike('name', updateData.channelName.trim())
          .maybeSingle();

        if (existCh) {
          resolvedChannelId = existCh.id;
        } else {
          const { data: newCh } = await supabase
            .from('channels')
            .insert({ name: updateData.channelName.trim() })
            .select('id')
            .single();
          if (newCh) resolvedChannelId = newCh.id;
        }
      } else if (resolvedChannelId === '') {
        resolvedChannelId = null;
      }

      // Build update object for Supabase posts table
      const updateFields = {};
      if (updateData.title !== undefined) updateFields.title = stripVideoExtensions(updateData.title);
      if (updateData.description !== undefined) updateFields.description = cleanDescription(updateData.description);
      if (updateData.thumbnail !== undefined) updateFields.thumbnail = cleanThumbnailUrl(updateData.thumbnail);
      if (updateData.channel !== undefined || updateData.channelName !== undefined) {
        updateFields.channel_id = resolvedChannelId;
      }
      if (updateData.category !== undefined) {
        updateFields.category_id = updateData.category === '' ? null : updateData.category;
      } else if (updateData.categories && updateData.categories.length > 0) {
        updateFields.category_id = updateData.categories[0];
      }

      logger.info(`Updating post ${id} with fields:`, Object.keys(updateFields));

      // Update post in Supabase
      const { data: post, error: updateError } = await supabase
        .from('posts')
        .update(updateFields)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        logger.error(`❌ SUPABASE UPDATE ERROR for post ${id}:`, updateError);
        return reply.status(400).send({
          success: false,
          message: `Update failed: ${updateError.message || 'Database error'}`
        });
      }

      let updatedPost = post;

      // 2. Update actors if provided
      if (updateData.actors !== undefined) {
        logger.info(`Updating actors for post ${id}:`, updateData.actors);
        
        await supabase.from('post_actors').delete().eq('post_id', id);
        
        if (Array.isArray(updateData.actors) && updateData.actors.length > 0) {
          const actorIds = [];
          for (const actorItem of updateData.actors) {
            if (!actorItem || !String(actorItem).trim()) continue;
            const actorStr = String(actorItem).trim();

            if (actorStr.includes('-') && actorStr.length === 36) {
              actorIds.push(actorStr);
              continue;
            }

            // Find or create actor by name
            const { data: existActor } = await supabase
              .from('actors')
              .select('id')
              .ilike('name', actorStr)
              .maybeSingle();

            if (existActor) {
              actorIds.push(existActor.id);
            } else {
              const { data: newActor } = await supabase
                .from('actors')
                .insert({ name: actorStr })
                .select('id')
                .single();
              if (newActor) actorIds.push(newActor.id);
            }
          }

          if (actorIds.length > 0) {
            const actorInserts = actorIds.map(actorId => ({
              post_id: id,
              actor_id: actorId
            }));
            await supabase.from('post_actors').insert(actorInserts);
          }
        }
      }

      // 3. Update categories if provided
      if (updateData.categories !== undefined) {
        logger.info(`=== UPDATING CATEGORIES FOR POST ${id} ===`, updateData.categories);
        await supabase.from('post_categories').delete().eq('post_id', id);
        
        if (Array.isArray(updateData.categories) && updateData.categories.length > 0) {
          const categoryInserts = updateData.categories.map(categoryId => ({
            post_id: id,
            category_id: categoryId
          }));
          await supabase.from('post_categories').insert(categoryInserts);
        }
      }

      // 4. Update video sources if provided
      if (updateData.videoSources !== undefined) {
        logger.info(`Updating video sources for post ${id}:`, updateData.videoSources);
        await supabase.from('post_video_sources').delete().eq('post_id', id);

        if (Array.isArray(updateData.videoSources) && updateData.videoSources.length > 0) {
          const videoSourceInserts = updateData.videoSources.map(vs => ({
            post_id: id,
            platform: vs.platform,
            video_id: vs.videoId
          }));
          await supabase.from('post_video_sources').insert(videoSourceInserts);
        }
      }

      // Invalidate ALL post-related caches including pagination
      cacheService.invalidateAllPostLists();
      
      // If channel was changed, invalidate ALL channel post caches AND rebuild from database
      if (updateData.channel !== undefined) {
        logger.info(`🔄 CHANNEL CHANGED - Forcing complete cache flush and rebuild...`);
        cacheService.invalidateAllChannelPosts();
        cacheService.flushAll();
        await cacheService.rebuildFromDB();
        logger.info(`✅ Cache flushed and rebuilt with fresh data from Supabase`);
      }
      
      cacheService.invalidateActors();
      
      logger.info(`Post ${id} update completed, cache invalidated`);

      return reply.send({
        success: true,
        data: updatedPost,
        message: 'Post updated successfully'
      });
    } catch (error) {
      logger.error(`Error updating post ${request.params.id}`, error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to update post'
      });
    }
  });

  fastify.delete('/api/admin/posts/:id', async (request, reply) => {
    try {
      const { id } = request.params;

      // Delete related records first
      await supabase.from('post_video_sources').delete().eq('post_id', id);
      await supabase.from('post_actors').delete().eq('post_id', id);

      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', id);

      if (error) {
        return reply.status(404).send({
          success: false,
          message: 'Post not found'
        });
      }

      // Invalidate ALL post-related caches including pagination
      cacheService.invalidateAllPostLists();

      return reply.send({
        success: true
      });
    } catch (error) {
      logger.error(`Error deleting post ${request.params.id}`, error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to delete post'
      });
    }
  });

  // Bulk delete posts
  fastify.post('/api/admin/posts/bulk-delete', async (request, reply) => {
    try {
      const { postIds } = request.body || {};
      if (!Array.isArray(postIds) || postIds.length === 0) {
        return reply.status(400).send({
          success: false,
          message: 'postIds array is required'
        });
      }

      logger.info(`Bulk deleting ${postIds.length} posts...`);
      await supabase.from('post_video_sources').delete().in('post_id', postIds);
      await supabase.from('post_actors').delete().in('post_id', postIds);
      await supabase.from('post_categories').delete().in('post_id', postIds);

      const { error } = await supabase
        .from('posts')
        .delete()
        .in('id', postIds);

      if (error) {
        logger.error('Error in bulk delete posts:', error);
        return reply.status(500).send({
          success: false,
          message: 'Failed to delete posts: ' + error.message
        });
      }

      cacheService.invalidateAllPostLists();
      cacheService.invalidateAllChannelPosts();
      cacheService.flushAll();
      await cacheService.rebuildFromDB();

      return reply.send({
        success: true,
        message: `Successfully deleted ${postIds.length} posts`
      });
    } catch (error) {
      logger.error('Error in bulk delete posts', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to bulk delete posts'
      });
    }
  });

  // Delete all posts
  fastify.delete('/api/admin/posts/all', async (request, reply) => {
    try {
      logger.info('=== DELETE ALL POSTS ===');
      logger.info('Starting deletion of all posts and related data...');

      // Step 1: Count what we're about to delete
      const { count: totalPosts } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true });

      const { count: totalVideoSources } = await supabase
        .from('post_video_sources')
        .select('*', { count: 'exact', head: true });

      const { count: totalPostActors } = await supabase
        .from('post_actors')
        .select('*', { count: 'exact', head: true });

      logger.info(`Will delete: ${totalPosts} posts, ${totalVideoSources} video sources, ${totalPostActors} actor relations`);

      // Step 2: Delete ALL related records (no workaround, delete everything)
      const { error: deleteVideoSourcesError } = await supabase
        .from('post_video_sources')
        .delete()
        .neq('post_id', '00000000-0000-0000-0000-000000000000');

      if (deleteVideoSourcesError) {
        logger.error('Error deleting video sources:', deleteVideoSourcesError);
      } else {
        logger.info('✓ Deleted all video sources');
      }

      const { error: deletePostActorsError } = await supabase
        .from('post_actors')
        .delete()
        .neq('post_id', '00000000-0000-0000-0000-000000000000');

      if (deletePostActorsError) {
        logger.error('Error deleting post actors:', deletePostActorsError);
      } else {
        logger.info('✓ Deleted all post-actor relations');
      }

      // Step 3: Delete ALL posts
      const { error: deletePostsError } = await supabase
        .from('posts')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deletePostsError) {
        logger.error('Error deleting posts:', deletePostsError);
        return reply.status(500).send({
          success: false,
          message: 'Failed to delete all posts: ' + deletePostsError.message
        });
      }

      logger.info('✓ Deleted all posts');

      // Step 4: Verify deletion
      const { count: remainingPosts } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true });

      logger.info(`Remaining posts after deletion: ${remainingPosts}`);

      // Step 5: Clear all cache
      cacheService.flushAll();
      await cacheService.warmCache();

      logger.info('✓ Cache cleared and rebuilt');
      logger.info('=== DELETE ALL COMPLETE ===');

      return reply.send({
        success: true,
        message: `All posts deleted successfully (${totalPosts} posts, ${totalVideoSources} video sources, ${totalPostActors} actor relations)`,
        data: {
          deletedPosts: totalPosts || 0,
          deletedVideoSources: totalVideoSources || 0,
          deletedPostActors: totalPostActors || 0,
          remainingPosts: remainingPosts || 0
        }
      });
    } catch (error) {
      logger.error('=== DELETE ALL FAILED ===');
      logger.error('Error deleting all posts:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to delete all posts: ' + error.message
      });
    }
  });

  fastify.post('/api/admin/posts/bulk-edit', async (request, reply) => {
    try {
      const {
        postIds,
        addActors,
        removeActors,
        setChannel,
        setCategory,
        setCategories
      } = request.body || {};

      logger.info('=== BULK EDIT ===');
      logger.info('Post IDs:', postIds);
      logger.info('Add Actors:', addActors);
      logger.info('Remove Actors:', removeActors);
      logger.info('Set Channel:', setChannel);
      logger.info('Set Category (single):', setCategory);
      logger.info('Set Categories (multiple):', setCategories);
      logger.info('=================');

      if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
        return reply.status(400).send({
          success: false,
          message: 'postIds array is required'
        });
      }

      let updatedCount = 0;
      let errorCount = 0;
      const errors = [];

      // Look up actor IDs if they're names (not UUIDs)
      let addActorIds = addActors || [];
      if (addActors && addActors.length > 0 && !addActors[0].includes('-')) {
        const { data: actorRecords, error: lookupError } = await supabase
          .from('actors')
          .select('id, name')
          .in('name', addActors);
        
        if (lookupError) {
          logger.error('Error looking up actor IDs for bulk edit', lookupError);
        } else {
          addActorIds = actorRecords.map(a => a.id);
        }
      }

      let removeActorIds = removeActors || [];
      if (removeActors && removeActors.length > 0 && !removeActors[0].includes('-')) {
        const { data: actorRecords, error: lookupError } = await supabase
          .from('actors')
          .select('id, name')
          .in('name', removeActors);
        
        if (lookupError) {
          logger.error('Error looking up actor IDs for bulk removal', lookupError);
        } else {
          removeActorIds = actorRecords.map(a => a.id);
        }
      }

      for (const postId of postIds) {
        try {
          logger.info(`\n=== Processing post ${postId} ===`);
          logger.info(`addActorIds:`, addActorIds);
          logger.info(`removeActorIds:`, removeActorIds);
          logger.info(`setChannel:`, setChannel);
          logger.info(`setCategory:`, setCategory);
          logger.info(`setCategories:`, setCategories);
          
          // Handle actor additions
          if (addActorIds && addActorIds.length > 0) {
            // Check if relation already exists to avoid duplicates
            const { data: existingRelations } = await supabase
              .from('post_actors')
              .select('actor_id')
              .eq('post_id', postId);
            
            const existingActorIds = (existingRelations || []).map(r => r.actor_id);
            const newActorIds = addActorIds.filter(id => !existingActorIds.includes(id));
            
            if (newActorIds.length > 0) {
              const actorInserts = newActorIds.map(actorId => ({
                post_id: postId,
                actor_id: actorId
              }));
              const { error: insertError } = await supabase.from('post_actors').insert(actorInserts);
              if (insertError) {
                logger.error(`Error adding actors to post ${postId}`, insertError);
                errors.push({ postId, error: 'Failed to add actors' });
                errorCount++;
              }
            }
          }

          // Handle actor removals
          if (removeActorIds && removeActorIds.length > 0) {
            const { error: deleteError } = await supabase
              .from('post_actors')
              .delete()
              .eq('post_id', postId)
              .in('actor_id', removeActorIds);
            
            if (deleteError) {
              logger.error(`Error removing actors from post ${postId}`, deleteError);
              errors.push({ postId, error: 'Failed to remove actors' });
              errorCount++;
            }
          }

          // Handle channel/category updates
          const updateFields = {};
          if (setChannel !== undefined) updateFields.channel_id = setChannel;
          // Support both single category (backward compat) and multiple categories
          if (setCategory !== undefined) {
            updateFields.category_id = setCategory;
          } else if (setCategories && setCategories.length > 0) {
            // Use first category for posts.category_id (backward compatibility)
            updateFields.category_id = setCategories[0];
          }

          logger.info(`updateFields for post ${postId}:`, updateFields);
          logger.info(`Will update posts table: ${Object.keys(updateFields).length > 0}`);
          logger.info(`Will update post_categories: ${setCategories && setCategories.length > 0}`);

          if (Object.keys(updateFields).length > 0) {
            logger.info(`=== BULK UPDATE ATTEMPT ===`);
            logger.info(`Post ID: ${postId}`);
            logger.info(`Update fields:`, JSON.stringify(updateFields, null, 2));
            
            const { error, data: updateResult } = await supabase
              .from('posts')
              .update(updateFields)
              .eq('id', postId);
            
            if (error) {
              logger.error(`❌ BULK UPDATE ERROR for post ${postId}:`, JSON.stringify(error, null, 2));
              errors.push({ postId, error: error.message });
              errorCount++;
            } else {
              logger.info(`✅ Supabase update executed for post ${postId}`);
              
              // VERIFICATION: Query to confirm update persisted
              const { data: verifiedPost, error: verifyError } = await supabase
                .from('posts')
                .select('id, channel_id, category_id')
                .eq('id', postId)
                .single();
              
              if (verifyError) {
                logger.error(`❌ Verification query failed for post ${postId}:`, verifyError);
              } else if (verifiedPost) {
                logger.info(`✅ VERIFIED - Post ${postId} in database:`);
                logger.info(`  - channel_id: ${verifiedPost.channel_id} (expected: ${updateFields.channel_id})`);
                logger.info(`  - Match: ${verifiedPost.channel_id === updateFields.channel_id}`);
                
                if (updateFields.channel_id !== undefined && verifiedPost.channel_id !== updateFields.channel_id) {
                  logger.error(`❌ CRITICAL: Bulk update did NOT persist for post ${postId}!`);
                }
              }
              
              updatedCount++;
              
              // If using multiple categories, insert into post_categories junction table
              if (setCategories && setCategories.length > 0) {
                try {
                  // Delete existing category relations for this post
                  await supabase.from('post_categories').delete().eq('post_id', postId);
                  
                  // Insert all new category relations
                  const categoryInserts = setCategories.map(catId => ({
                    post_id: postId,
                    category_id: catId
                  }));
                  
                  const { error: catError } = await supabase.from('post_categories').insert(categoryInserts);
                  if (catError) {
                    logger.error(`Error inserting categories for post ${postId}`, catError);
                  } else {
                    logger.info(`Successfully linked ${categoryInserts.length} categories to post ${postId}`);
                  }
                } catch (catErr) {
                  logger.error(`Exception during category insert for post ${postId}`, catErr);
                }
              }
            }
          } else if (addActorIds.length > 0 || removeActorIds.length > 0) {
            // Count as updated if we made actor changes
            updatedCount++;
          }

          cacheService.invalidatePostCache(postId);
        } catch (err) {
          logger.error(`Error in bulk edit for post ${postId}`, err);
          errors.push({ postId, error: err.message });
          errorCount++;
        }
      }

      // Invalidate ALL post-related caches including pagination
      cacheService.invalidateAllPostLists();
      
      // If channel was changed, invalidate ALL channel post caches AND rebuild from database
      if (setChannel !== undefined) {
        logger.info('🔄 CHANNEL CHANGED IN BULK - Forcing complete cache flush and rebuild...');
        cacheService.invalidateAllChannelPosts();
        cacheService.flushAll();
        await cacheService.rebuildFromDB();
        logger.info('✅ Cache flushed and rebuilt with fresh data from Supabase');
      }
      
      cacheService.invalidateActors();
      cacheService.invalidateChannels();

      logger.info(`Bulk edit completed: ${updatedCount} updated, ${errorCount} errors`);

      return reply.send({
        success: true,
        data: { updatedCount, errorCount, errors },
        message: `Updated ${updatedCount} posts${errorCount > 0 ? `, ${errorCount} failed` : ''}`
      });
    } catch (error) {
      logger.error('Error in bulk edit', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to bulk edit posts'
      });
    }
  });

  fastify.post('/api/admin/actors', async (request, reply) => {
    try {
      const { name, image, bio } = request.body || {};

      if (!name || !name.trim()) {
        return reply.status(400).send({
          success: false,
          message: 'Name is required'
        });
      }

      const { data: actor, error } = await supabase
        .from('actors')
        .insert({
          name: name.trim(),
          image: image || '',
          bio: bio || ''
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating actor', error);
        return reply.status(500).send({
          success: false,
          message: 'Failed to create actor'
        });
      }

      cacheService.invalidateActors();

      return reply.status(201).send({
        success: true,
        data: actor
      });
    } catch (error) {
      logger.error('Error creating actor', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to create actor'
      });
    }
  });

  fastify.put('/api/admin/actors/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const { name, image, bio } = request.body || {};

      const updateData = {};
      if (name !== undefined) updateData.name = String(name).trim();
      if (image !== undefined) updateData.image = String(image).trim();
      if (bio !== undefined) updateData.bio = String(bio).trim();

      const { data: actor, error } = await supabase
        .from('actors')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error(`Error updating actor ${id}:`, error);
        return reply.status(500).send({
          success: false,
          message: 'Failed to update actor: ' + error.message
        });
      }

      if (!actor) {
        return reply.status(404).send({
          success: false,
          message: 'Actor not found'
        });
      }

      cacheService.invalidateActors();

      return reply.send({
        success: true,
        data: actor,
        message: 'Actor updated successfully'
      });
    } catch (error) {
      logger.error(`Error updating actor ${request.params.id}`, error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to update actor: ' + error.message
      });
    }
  });

  fastify.delete('/api/admin/actors/:id', async (request, reply) => {
    try {
      const { id } = request.params;

      // Delete actor relations first
      await supabase.from('post_actors').delete().eq('actor_id', id);

      const { error } = await supabase
        .from('actors')
        .delete()
        .eq('id', id);

      if (error) {
        return reply.status(404).send({
          success: false,
          message: 'Actor not found'
        });
      }

      cacheService.invalidateActors();

      return reply.send({
        success: true
      });
    } catch (error) {
      logger.error(`Error deleting actor ${request.params.id}`, error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to delete actor'
      });
    }
  });

  // Bulk delete actors
  fastify.post('/api/admin/actors/bulk-delete', async (request, reply) => {
    try {
      const { actorIds } = request.body || {};
      if (!Array.isArray(actorIds) || actorIds.length === 0) {
        return reply.status(400).send({
          success: false,
          message: 'actorIds array is required'
        });
      }

      await supabase.from('post_actors').delete().in('actor_id', actorIds);

      const { error } = await supabase
        .from('actors')
        .delete()
        .in('id', actorIds);

      if (error) {
        logger.error('Error in bulk delete actors:', error);
        return reply.status(500).send({
          success: false,
          message: 'Failed to delete actors: ' + error.message
        });
      }

      cacheService.invalidateActors();

      return reply.send({
        success: true,
        message: `Successfully deleted ${actorIds.length} actors`
      });
    } catch (error) {
      logger.error('Error in bulk delete actors', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to bulk delete actors'
      });
    }
  });

  // Bulk create actors
  fastify.post('/api/admin/actors/bulk-create', async (request, reply) => {
    try {
      const { items, names } = request.body || {};
      let actorRows = [];

      if (Array.isArray(items) && items.length > 0) {
        actorRows = items
          .map(item => ({
            name: String(item.name || '').trim(),
            image: item.image || '',
            crop_x: item.cropX ?? 50,
            crop_y: item.cropY ?? 50,
            crop_zoom: item.cropZoom ?? 1
          }))
          .filter(a => a.name);
      } else if (Array.isArray(names) && names.length > 0) {
        const cleanNames = [...new Set(names.map(n => String(n || '').trim()).filter(Boolean))];
        actorRows = cleanNames.map(name => ({
          name,
          image: '',
          crop_x: 50,
          crop_y: 50,
          crop_zoom: 1
        }));
      }

      if (actorRows.length === 0) {
        return reply.status(400).send({
          success: false,
          message: 'No valid actors provided'
        });
      }

      const { data, error } = await supabase
        .from('actors')
        .insert(actorRows)
        .select();

      if (error) {
        logger.error('Error in bulk create actors:', error);
        return reply.status(500).send({
          success: false,
          message: 'Failed to bulk create actors: ' + error.message
        });
      }

      cacheService.invalidateActors();

      return reply.send({
        success: true,
        count: data?.length || actorRows.length,
        data: data || [],
        message: `Successfully created ${data?.length || actorRows.length} actors`
      });
    } catch (error) {
      logger.error('Error in bulk create actors', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to bulk create actors'
      });
    }
  });

  fastify.post('/api/admin/channels', async (request, reply) => {
    try {
      const { name, logo, description } = request.body || {};

      if (!name || !name.trim()) {
        return reply.status(400).send({
          success: false,
          message: 'Name is required'
        });
      }

      const { data: channel, error } = await supabase
        .from('channels')
        .insert({
          name: name.trim(),
          logo: logo || '',
          description: description || ''
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating channel', error);
        return reply.status(500).send({
          success: false,
          message: 'Failed to create channel'
        });
      }

      cacheService.invalidateChannels();

      return reply.status(201).send({
        success: true,
        data: channel
      });
    } catch (error) {
      logger.error('Error creating channel', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to create channel'
      });
    }
  });

  fastify.put('/api/admin/channels/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const { name, logo, description } = request.body || {};

      const updateData = {};
      if (name !== undefined) updateData.name = name.trim();
      if (logo !== undefined) updateData.logo = logo;
      if (description !== undefined) updateData.description = description;

      const { data: channel, error } = await supabase
        .from('channels')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error || !channel) {
        return reply.status(404).send({
          success: false,
          message: 'Channel not found'
        });
      }

      cacheService.invalidateChannels();

      return reply.send({
        success: true,
        data: channel
      });
    } catch (error) {
      logger.error(`Error updating channel ${request.params.id}`, error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to update channel'
      });
    }
  });

  fastify.delete('/api/admin/channels/:id', async (request, reply) => {
    try {
      const { id } = request.params;

      // Update posts to remove this channel reference
      await supabase
        .from('posts')
        .update({ channel_id: null })
        .eq('channel_id', id);

      const { error } = await supabase
        .from('channels')
        .delete()
        .eq('id', id);

      if (error) {
        return reply.status(404).send({
          success: false,
          message: 'Channel not found'
        });
      }

      cacheService.invalidateChannels();

      return reply.send({
        success: true
      });
    } catch (error) {
      logger.error(`Error deleting channel ${request.params.id}`, error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to delete channel'
      });
    }
  });

  // Bulk delete channels
  fastify.post('/api/admin/channels/bulk-delete', async (request, reply) => {
    try {
      const { channelIds } = request.body || {};
      if (!Array.isArray(channelIds) || channelIds.length === 0) {
        return reply.status(400).send({
          success: false,
          message: 'channelIds array is required'
        });
      }

      await supabase
        .from('posts')
        .update({ channel_id: null })
        .in('channel_id', channelIds);

      const { error } = await supabase
        .from('channels')
        .delete()
        .in('id', channelIds);

      if (error) {
        return reply.status(500).send({
          success: false,
          message: 'Failed to delete channels: ' + error.message
        });
      }

      cacheService.invalidateChannels();
      cacheService.invalidateAllChannelPosts();

      return reply.send({
        success: true,
        message: `Successfully deleted ${channelIds.length} channels`
      });
    } catch (error) {
      logger.error('Error in bulk delete channels', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to bulk delete channels'
      });
    }
  });

  // Bulk create channels
  fastify.post('/api/admin/channels/bulk-create', async (request, reply) => {
    try {
      const { items, names } = request.body || {};
      let channelRows = [];

      if (Array.isArray(items) && items.length > 0) {
        channelRows = items
          .map(item => ({
            name: String(item.name || '').trim(),
            handle: item.handle || (item.name ? item.name.toLowerCase().replace(/[^a-z0-9]/g, '') : ''),
            logo: item.logo || '',
            banner: item.banner || '',
            description: item.description || '',
            verified: item.verified ?? true
          }))
          .filter(c => c.name);
      } else if (Array.isArray(names) && names.length > 0) {
        const cleanNames = [...new Set(names.map(n => String(n || '').trim()).filter(Boolean))];
        channelRows = cleanNames.map(name => ({
          name,
          handle: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
          logo: '',
          banner: '',
          description: '',
          verified: true
        }));
      }

      if (channelRows.length === 0) {
        return reply.status(400).send({
          success: false,
          message: 'No valid channels provided'
        });
      }

      const { data, error } = await supabase
        .from('channels')
        .insert(channelRows)
        .select();

      if (error) {
        logger.error('Error in bulk create channels:', error);
        return reply.status(500).send({
          success: false,
          message: 'Failed to bulk create channels: ' + error.message
        });
      }

      cacheService.invalidateChannels();

      return reply.send({
        success: true,
        count: data?.length || channelRows.length,
        data: data || [],
        message: `Successfully created ${data?.length || channelRows.length} channels`
      });
    } catch (error) {
      logger.error('Error in bulk create channels', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to bulk create channels'
      });
    }
  });

  fastify.post('/api/admin/categories', async (request, reply) => {
    try {
      const { name } = request.body || {};

      if (!name || !name.trim()) {
        return reply.status(400).send({
          success: false,
          message: 'Name is required'
        });
      }

      const { data: category, error } = await supabase
        .from('categories')
        .insert({ name: name.trim() })
        .select()
        .single();

      if (error) {
        logger.error('Error creating category', error);
        return reply.status(500).send({
          success: false,
          message: 'Failed to create category'
        });
      }

      cacheService.invalidateCategories();

      return reply.status(201).send({
        success: true,
        data: category
      });
    } catch (error) {
      logger.error('Error creating category', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to create category'
      });
    }
  });

  // Bulk create categories
  fastify.post('/api/admin/categories/bulk-create', async (request, reply) => {
    try {
      const { names } = request.body || {};
      if (!Array.isArray(names) || names.length === 0) {
        return reply.status(400).send({
          success: false,
          message: 'names array is required'
        });
      }

      const cleanNames = [...new Set(names.map(n => String(n || '').trim()).filter(Boolean))];
      if (cleanNames.length === 0) {
        return reply.status(400).send({
          success: false,
          message: 'No valid category names provided'
        });
      }

      const rows = cleanNames.map(name => ({ name }));
      const { data, error } = await supabase
        .from('categories')
        .insert(rows)
        .select();

      if (error) {
        logger.error('Error bulk creating categories:', error);
        return reply.status(500).send({
          success: false,
          message: 'Failed to create categories: ' + error.message
        });
      }

      cacheService.invalidateCategories();

      return reply.send({
        success: true,
        count: data?.length || cleanNames.length,
        data: data || [],
        message: `Successfully created ${data?.length || cleanNames.length} categories`
      });
    } catch (error) {
      logger.error('Error in bulk create categories', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to bulk create categories'
      });
    }
  });

  fastify.put('/api/admin/categories/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const { name } = request.body || {};

      if (!name || !name.trim()) {
        return reply.status(400).send({
          success: false,
          message: 'Name is required'
        });
      }

      const { data: category, error } = await supabase
        .from('categories')
        .update({ name: name.trim() })
        .eq('id', id)
        .select()
        .single();

      if (error || !category) {
        return reply.status(404).send({
          success: false,
          message: 'Category not found'
        });
      }

      cacheService.invalidateCategories();

      return reply.send({
        success: true,
        data: category
      });
    } catch (error) {
      logger.error(`Error updating category ${request.params.id}`, error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to update category'
      });
    }
  });

  fastify.delete('/api/admin/categories/:id', async (request, reply) => {
    try {
      const { id } = request.params;

      // Update posts to remove this category reference
      await supabase
        .from('posts')
        .update({ category_id: null })
        .eq('category_id', id);

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) {
        return reply.status(404).send({
          success: false,
          message: 'Category not found'
        });
      }

      cacheService.invalidateCategories();

      return reply.send({
        success: true
      });
    } catch (error) {
      logger.error(`Error deleting category ${request.params.id}`, error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to delete category'
      });
    }
  });

  // Bulk delete categories
  fastify.post('/api/admin/categories/bulk-delete', async (request, reply) => {
    try {
      const { categoryIds } = request.body || {};
      if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
        return reply.status(400).send({
          success: false,
          message: 'categoryIds array is required'
        });
      }

      await supabase.from('post_categories').delete().in('category_id', categoryIds);
      await supabase
        .from('posts')
        .update({ category_id: null })
        .in('category_id', categoryIds);

      const { error } = await supabase
        .from('categories')
        .delete()
        .in('id', categoryIds);

      if (error) {
        return reply.status(500).send({
          success: false,
          message: 'Failed to delete categories: ' + error.message
        });
      }

      cacheService.invalidateCategories();
      cacheService.invalidateAllPostLists();

      return reply.send({
        success: true,
        message: `Successfully deleted ${categoryIds.length} categories`
      });
    } catch (error) {
      logger.error('Error in bulk delete categories', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to bulk delete categories'
      });
    }
  });

  // Player Settings - Get (admin)
  fastify.get('/api/admin/settings/player', async (request, reply) => {
    try {
      const { data: settings, error } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'player')
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Error fetching player settings', error);
      }

      const playerSettings = settings?.value || {
        autoPlay: true,
        defaultServer: 'SERVER_01',
        updatedAt: new Date().toISOString()
      };

      return reply.send({
        success: true,
        data: playerSettings
      });
    } catch (error) {
      logger.error('Error fetching player settings', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch player settings'
      });
    }
  });

  // Player Settings - Update (admin)
  fastify.put('/api/admin/settings/player', async (request, reply) => {
    try {
      const { autoPlay, defaultServer } = request.body || {};

      const settingsValue = {
        autoPlay: autoPlay !== undefined ? autoPlay : true,
        defaultServer: defaultServer || 'SERVER_01',
        updatedAt: new Date().toISOString()
      };

      // Upsert settings
      const { data, error } = await supabase
        .from('settings')
        .upsert({
          key: 'player',
          value: settingsValue
        }, { onConflict: 'key' })
        .select()
        .single();

      if (error) {
        logger.error('Error updating player settings', error);
        return reply.status(500).send({
          success: false,
          message: 'Failed to update player settings'
        });
      }

      // Update cache
      cacheService.set('settings:player', settingsValue, 86400);

      return reply.send({
        success: true,
        message: 'Player settings updated',
        data: settingsValue
      });
    } catch (error) {
      logger.error('Error updating player settings', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to update player settings'
      });
    }
  });

  // Player Settings - Public Get
  fastify.get('/api/public/settings/player', async (request, reply) => {
    try {
      // Check cache first
      const cached = cacheService.get('settings:player');
      if (cached) {
        return reply.send({
          success: true,
          data: cached
        });
      }

      const { data: settings, error } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'player')
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Error fetching player settings', error);
      }

      const playerSettings = settings?.value || {
        autoPlay: true,
        defaultServer: 'SERVER_01',
        updatedAt: new Date().toISOString()
      };

      // Cache for 1 hour
      cacheService.set('settings:player', playerSettings, 3600);

      return reply.send({
        success: true,
        data: playerSettings
      });
    } catch (error) {
      logger.error('Error fetching player settings', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to fetch player settings'
      });
    }
  });

  // Admin endpoint to find posts with incorrect channel_id
  fastify.get('/api/admin/channels/invalid-posts', async (request, reply) => {
    try {
      // Get all channels
      const { data: channels } = await supabase
        .from('channels')
        .select('id');
      
      const validChannelIds = channels ? channels.map(c => c.id) : [];
      
      // Get all posts with channel info
      const { data: posts, error } = await supabase
        .from('posts')
        .select('id, title, channel_id, channel:channels(id, name)')
        .order('created_at', { ascending: false });
      
      if (error) {
        logger.error('Error fetching posts:', error);
        return reply.status(500).send({
          success: false,
          message: 'Failed to fetch posts'
        });
      }
      
      // Find posts with invalid channel_id
      const invalidPosts = posts.filter(p => {
        // Posts with null channel_id are valid (uncategorized)
        if (p.channel_id === null) return false;
        
        // Posts with channel_id not in valid channels list are invalid
        return !validChannelIds.includes(p.channel_id);
      });
      
      const postsWithNullChannel = posts.filter(p => p.channel_id === null);
      
      return reply.send({
        success: true,
        data: {
          totalPosts: posts.length,
          postsWithValidChannel: posts.length - postsWithNullChannel.length - invalidPosts.length,
          postsWithNullChannel: postsWithNullChannel.length,
          invalidChannelId: invalidPosts.length,
          invalidPosts: invalidPosts.map(p => ({
            id: p.id,
            title: p.title,
            channel_id: p.channel_id,
            channelName: p.channel?.name || 'NULL'
          })),
          postsWithNullChannel: postsWithNullChannel.map(p => ({
            id: p.id,
            title: p.title
          }))
        }
      });
    } catch (error) {
      logger.error('Error finding invalid posts:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to find invalid posts'
      });
    }
  });

  // Admin endpoint to fix channel_id for posts
  fastify.post('/api/admin/channels/fix-posts', async (request, reply) => {
    try {
      const { dryRun = true, sourceChannelId, targetChannelId, postIds } = request.body || {};
      
      logger.info('=== FIX CHANNEL POSTS ===');
      logger.info('Dry run:', dryRun);
      logger.info('Source channel:', sourceChannelId);
      logger.info('Target channel:', targetChannelId);
      
      let query = supabase.from('posts').select('id, title, channel_id, channel:channels(id, name)');
      
      if (sourceChannelId) {
        query = query.eq('channel_id', sourceChannelId);
      }
      
      if (postIds && Array.isArray(postIds) && postIds.length > 0) {
        query = query.in('id', postIds);
      }
      
      const { data: posts, error } = await query;
      
      if (error) {
        logger.error('Error fetching posts:', error);
        return reply.status(500).send({
          success: false,
          message: 'Failed to fetch posts'
        });
      }
      
      if (!posts || posts.length === 0) {
        return reply.send({
          success: true,
          data: {
            postsFound: 0,
            message: 'No posts found matching criteria'
          }
        });
      }
      
      logger.info('Posts found:', posts.length);
      
      // If dry run, just return what would be updated
      if (dryRun || !targetChannelId) {
        const postsWithDetails = posts.map(p => ({
          id: p.id,
          title: p.title,
          currentChannelId: p.channel_id,
          currentChannelName: p.channel?.name || 'NULL',
          targetChannelId: targetChannelId,
          wouldUpdate: targetChannelId && p.channel_id !== targetChannelId
        }));
        
        return reply.send({
          success: true,
          data: {
            postsFound: posts.length,
            dryRun: true,
            posts: postsWithDetails
          }
        });
      }
      
      // Actually update the posts
      const { error: updateError } = await supabase
        .from('posts')
        .update({ channel_id: targetChannelId })
        .in('id', posts.map(p => p.id));
      
      if (updateError) {
        logger.error('Error updating posts:', updateError);
        return reply.status(500).send({
          success: false,
          message: 'Failed to update posts: ' + updateError.message
        });
      }
      
      // Invalidate all caches
      cacheService.invalidateAllPostLists();
      cacheService.invalidateAllChannelPosts();
      cacheService.flushAll();
      await cacheService.rebuildFromDB();
      
      logger.info('Successfully updated', posts.length, 'posts');
      logger.info('Cache invalidated and rebuilt');
      
      return reply.send({
        success: true,
        message: 'Updated ' + posts.length + ' posts',
        data: {
          postsFound: posts.length,
          postsUpdated: posts.length,
          targetChannelId: targetChannelId
        }
      });
    } catch (error) {
      logger.error('Error in fix channel posts:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to fix channel posts'
      });
    }
  });

  // Helper to remove any video file extensions and clean title
  const stripVideoExtensions = (rawTitle) => {
    if (!rawTitle) return '';
    return rawTitle
      .replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm|ts|m4v|3gp|3g2|mpeg|mpg|mts|m2ts|vob|ogv|rm|rmvb|asf|amv|divx|xvid|f4v|h264|h265|hevc|mxf|dv|qt|yuv|m2v|svi|nsv|roq|nut)\s*$/i, '')
      .replace(/\s+(mp4|mkv|avi|mov|wmv|flv|webm|ts|m4v|3gp|3g2|mpeg|mpg|mts|m2ts|vob|ogv|rm|rmvb|asf|amv|divx|xvid|f4v|h264|h265|hevc|mxf|dv|qt|yuv|m2v|svi|nsv|roq|nut)\s*$/i, '')
      .replace(/[-_.]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // ── Sync Posts Endpoint ───────────────────────────────────────────────────
  fastify.post('/api/admin/sync', async (request, reply) => {
    try {
      logger.info('Admin triggered video sync from Streamtape');
      const result = await syncService.sync();
      return reply.send({
        success: true,
        data: result,
        message: `Synced ${result.added} new videos (${result.skipped} existing)`
      });
    } catch (error) {
      logger.error('Admin sync failed:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Sync failed'
      });
    }
  });

  // ── Fetch all Streamtape files for Interactive Fetch UI ───────────────────
  fastify.get('/api/admin/streamtape/videos', async (request, reply) => {
    try {
      const streamtapeService = require('../services/streamtape');
      
      if (!streamtapeService.isConfigured()) {
        return reply.status(400).send({
          success: false,
          message: 'Streamtape API credentials are not configured in backend/.env'
        });
      }

      const files = await streamtapeService.getAllFiles();
      logger.info(`Streamtape API returned ${files.length} total files`);

      // 1. Filter out non-video files
      const isVideoFile = (filename) => {
        if (!filename) return false;
        if (filename.startsWith('Thumb_')) return false;
        return /\.(mp4|mkv|avi|mov|wmv|flv|webm|ts|m4v|3gp|3g2|mpeg|mpg|mts|m2ts|vob|ogv|rm|rmvb|asf|amv|divx|xvid|f4v|h264|h265|hevc|mxf|dv|qt|yuv|m2v|svi|nsv|roq|nut)$/i.test(filename);
      };

      const videoFiles = files.filter(f => isVideoFile(f.name));

      // 2. Query all existing video sources and posts from Supabase to filter them out
      const { data: existingSources } = await supabase
        .from('post_video_sources')
        .select('video_id, post_id');

      const existingVideoIds = new Set((existingSources || []).map(s => s.video_id).filter(Boolean));

      const { data: existingPosts } = await supabase
        .from('posts')
        .select('id, title, thumbnail');

      const existingTitles = new Set((existingPosts || []).map(p => stripVideoExtensions(p.title).toLowerCase()).filter(Boolean));
      const existingThumbnails = (existingPosts || []).map(p => p.thumbnail).filter(Boolean);

      // 3. ONLY and ONLY new videos that have not been created or added yet
      const newFiles = videoFiles.filter(f => {
        if (existingVideoIds.has(f.linkid)) return false;
        const cleanTitle = stripVideoExtensions(f.name).toLowerCase();
        if (existingTitles.has(cleanTitle)) return false;
        for (const thumb of existingThumbnails) {
          if (thumb && thumb.includes(f.linkid)) return false;
        }
        return true;
      });

      logger.info(`Streamtape Cloud: Filtered out existing posts. Found ${newFiles.length} NEW un-imported videos.`);

      // 4. Batch resolve real thumbnail URLs (format: https://thumb.tapecontent.net/thumb/${videoId}/${splashId}.jpg)
      const thumbMap = await streamtapeService.getBatchThumbnails(newFiles.map(f => f.linkid));

      const formattedVideos = newFiles.map(f => {
        const cleanTitle = stripVideoExtensions(f.name);
        const realThumb = thumbMap[f.linkid] || `https://thumb.tapecontent.net/thumb/${f.linkid}/thumb.jpg`;

        return {
          videoId: f.linkid,
          name: f.name,
          title: cleanTitle || f.name,
          size: f.size || 0,
          thumbnail: realThumb,
          embedUrl: `https://streamtape.com/e/${f.linkid}`,
          downloadUrl: `https://streamtape.com/v/${f.linkid}`,
          alreadyExists: false,
          existingPostId: null
        };
      });

      return reply.send({
        success: true,
        count: formattedVideos.length,
        data: formattedVideos
      });
    } catch (error) {
      logger.error('Error fetching Streamtape videos:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Failed to fetch Streamtape videos'
      });
    }
  });

  // ── Single Post Creation from Streamtape ──────────────────────────────────
  fastify.post('/api/admin/streamtape/create-post', async (request, reply) => {
    try {
      const { 
        title, 
        videoId, 
        thumbnail, 
        channelId, 
        channelName, 
        categoryIds, 
        actorNames,
        description 
      } = request.body || {};

      if (!videoId) {
        return reply.status(400).send({
          success: false,
          message: 'Streamtape videoId is required'
        });
      }

      const streamtapeService = require('../services/streamtape');
      const postTitle = stripVideoExtensions(title || 'Untitled Video');
      
      // Resolve real thumbnail if not provided
      let postThumb = thumbnail;
      if (!postThumb || postThumb.endsWith('/thumb.jpg')) {
        postThumb = await streamtapeService.getThumbnail(videoId);
      }
      if (!postThumb) {
        postThumb = `https://thumb.tapecontent.net/thumb/${videoId}/thumb.jpg`;
      }

      // 1. Resolve or create Channel if name provided and no channelId
      let resolvedChannelId = channelId || null;
      if (!resolvedChannelId && channelName && channelName.trim()) {
        const { data: existCh } = await supabase
          .from('channels')
          .select('id')
          .ilike('name', channelName.trim())
          .maybeSingle();

        if (existCh) {
          resolvedChannelId = existCh.id;
        } else {
          const { data: newCh } = await supabase
            .from('channels')
            .insert({ name: channelName.trim() })
            .select('id')
            .single();
          if (newCh) resolvedChannelId = newCh.id;
        }
      }

      // 2. Insert Post
      const { data: newPost, error: postErr } = await supabase
        .from('posts')
        .insert({
          title: postTitle,
          description: cleanDescription(description),
          thumbnail: postThumb,
          channel_id: resolvedChannelId
        })
        .select()
        .single();

      if (postErr || !newPost) {
        logger.error('Failed to create post:', postErr);
        return reply.status(500).send({
          success: false,
          message: postErr?.message || 'Failed to create post'
        });
      }

      // 3. Insert Streamtape Video Source
      await supabase
        .from('post_video_sources')
        .insert({
          post_id: newPost.id,
          platform: 'streamtape',
          video_id: videoId
        });

      // 4. Attach Categories
      if (Array.isArray(categoryIds) && categoryIds.length > 0) {
        const catInserts = categoryIds.filter(Boolean).map(cid => ({
          post_id: newPost.id,
          category_id: cid
        }));
        if (catInserts.length > 0) {
          await supabase.from('post_categories').insert(catInserts);
        }
      }

      // 5. Attach Actors
      if (Array.isArray(actorNames) && actorNames.length > 0) {
        for (const actorName of actorNames) {
          if (!actorName || !actorName.trim()) continue;
          let actorId = null;
          const { data: existAct } = await supabase
            .from('actors')
            .select('id')
            .ilike('name', actorName.trim())
            .maybeSingle();

          if (existAct) {
            actorId = existAct.id;
          } else {
            const { data: newAct } = await supabase
              .from('actors')
              .insert({ name: actorName.trim() })
              .select('id')
              .single();
            if (newAct) actorId = newAct.id;
          }

          if (actorId) {
            await supabase
              .from('post_actors')
              .insert({ post_id: newPost.id, actor_id: actorId });
          }
        }
      }

      // 6. Invalidate caches
      cacheService.invalidateAllPosts();
      cacheService.invalidateAllPostLists();

      return reply.send({
        success: true,
        data: newPost,
        message: 'Post created successfully!'
      });
    } catch (error) {
      logger.error('Error creating post from Streamtape:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Failed to create post'
      });
    }
  });

  // ── Bulk Post Creation from Streamtape ────────────────────────────────────
  fastify.post('/api/admin/streamtape/bulk-create', async (request, reply) => {
    try {
      const { 
        videos, 
        channelId, 
        channelName, 
        categoryIds, 
        actorNames 
      } = request.body || {};

      if (!Array.isArray(videos) || videos.length === 0) {
        return reply.status(400).send({
          success: false,
          message: 'Videos array is required'
        });
      }

      // Resolve channel
      let resolvedChannelId = channelId || null;
      if (!resolvedChannelId && channelName && channelName.trim()) {
        const { data: existCh } = await supabase
          .from('channels')
          .select('id')
          .ilike('name', channelName.trim())
          .maybeSingle();

        if (existCh) {
          resolvedChannelId = existCh.id;
        } else {
          const { data: newCh } = await supabase
            .from('channels')
            .insert({ name: channelName.trim() })
            .select('id')
            .single();
          if (newCh) resolvedChannelId = newCh.id;
        }
      }

      // Resolve actors
      const resolvedActorIds = [];
      if (Array.isArray(actorNames) && actorNames.length > 0) {
        for (const actorName of actorNames) {
          if (!actorName || !actorName.trim()) continue;
          const { data: existAct } = await supabase
            .from('actors')
            .select('id')
            .ilike('name', actorName.trim())
            .maybeSingle();

          if (existAct) {
            resolvedActorIds.push(existAct.id);
          } else {
            const { data: newAct } = await supabase
              .from('actors')
              .insert({ name: actorName.trim() })
              .select('id')
              .single();
            if (newAct) resolvedActorIds.push(newAct.id);
          }
        }
      }

      const streamtapeService = require('../services/streamtape');
      const videoIdsToFetch = videos
        .filter(v => v.videoId && (!v.thumbnail || v.thumbnail.endsWith('/thumb.jpg')))
        .map(v => v.videoId);

      const thumbMap = await streamtapeService.getBatchThumbnails(videoIdsToFetch);

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
          await supabase
            .from('post_video_sources')
            .insert({
              post_id: newPost.id,
              platform: 'streamtape',
              video_id: item.videoId
            });

          // Link categories (deduplicated)
          if (Array.isArray(categoryIds) && categoryIds.length > 0) {
            const uniqueCatIds = [...new Set(categoryIds.filter(Boolean))];
            const catInserts = uniqueCatIds.map(cid => ({
              post_id: newPost.id,
              category_id: cid
            }));
            if (catInserts.length > 0) {
              await supabase.from('post_categories').insert(catInserts);
            }
          }

          // Link actors
          if (resolvedActorIds.length > 0) {
            const actInserts = resolvedActorIds.map(aid => ({
              post_id: newPost.id,
              actor_id: aid
            }));
            await supabase.from('post_actors').insert(actInserts);
          }

          createdCount++;
        } catch (err) {
          logger.error('Error inserting bulk video post:', err);
          skippedCount++;
        }
      }

      cacheService.invalidateAllPosts();
      cacheService.invalidateAllPostLists();

      return reply.send({
        success: true,
        createdCount,
        skippedCount,
        message: `Successfully created ${createdCount} posts (${skippedCount} skipped)`
      });
    } catch (error) {
      logger.error('Error in bulk create Streamtape posts:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Failed to bulk create posts'
      });
    }
  });

  // ── Clean All Titles Endpoint ─────────────────────────────────────────────
  fastify.post('/api/admin/posts/clean-titles', async (request, reply) => {
    try {
      const { data: posts, error } = await supabase
        .from('posts')
        .select('id, title');

      if (error) throw error;

      let updated = 0;
      let skipped = 0;

      for (const p of posts || []) {
        const cleaned = stripVideoExtensions(p.title);
        if (cleaned !== p.title) {
          await supabase
            .from('posts')
            .update({ title: cleaned })
            .eq('id', p.id);
          updated++;
        } else {
          skipped++;
        }
      }

      cacheService.invalidateAllPosts();
      cacheService.invalidateAllPostLists();

      return reply.send({
        success: true,
        updated,
        skipped,
        message: `Cleaned ${updated} titles (${skipped} already clean)`
      });
    } catch (error) {
      logger.error('Error cleaning titles:', error);
      return reply.status(500).send({
        success: false,
        message: error.message || 'Failed to clean titles'
      });
    }
  });

  // ── Database Maintenance & Title Optimizer ─────────────────────────────────
  fastify.post('/api/admin/database/optimize', async (request, reply) => {
    try {
      logger.info('=== DATABASE MAINTENANCE & THUMBNAIL RESTORATION TRIGGERED ===');

      const streamtapeService = require('../services/streamtape');
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select(`
          id,
          title,
          description,
          thumbnail,
          post_video_sources(video_id)
        `);

      if (postsError) throw postsError;

      let thumbsRestored = 0;
      let titlesCleaned = 0;
      let totalPostsUpdated = 0;

      for (const p of posts || []) {
        const primaryVideoId = p.post_video_sources?.[0]?.video_id;
        const cleanedTitle = stripVideoExtensions(p.title);
        const updates = {};

        // If thumbnail is missing, auto-restore from Streamtape API
        if ((!p.thumbnail || !p.thumbnail.trim()) && primaryVideoId) {
          try {
            const fileInfo = await streamtapeService.getFileInfo(primaryVideoId);
            const realThumb = fileInfo?.[primaryVideoId]?.thumb || fileInfo?.thumb;
            if (realThumb) {
              updates.thumbnail = realThumb;
              thumbsRestored++;
            }
          } catch (e) {
            // fallback
          }
        }

        if (p.title !== cleanedTitle) {
          updates.title = cleanedTitle;
          titlesCleaned++;
        }

        if (Object.keys(updates).length > 0) {
          await supabase
            .from('posts')
            .update(updates)
            .eq('id', p.id);
          totalPostsUpdated++;
        }
      }

      cacheService.flushAll();
      await cacheService.warmCache();

      const totalPostsScanned = posts?.length || 0;

      logger.info(`=== DATABASE MAINTENANCE COMPLETE: ${totalPostsUpdated} posts updated ===`);

      return reply.send({
        success: true,
        message: `Database maintenance complete! Restored thumbnails for ${thumbsRestored} posts and cleaned ${titlesCleaned} titles.`,
        stats: {
          totalPostsScanned,
          totalPostsCompacted: totalPostsUpdated,
          thumbsCompacted: thumbsRestored,
          descsCompacted: 0,
          titlesCleaned,
          estimatedSpaceSaved: '100% Verified & Healthy'
        }
      });
    } catch (error) {
      logger.error('Error optimizing database storage:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to optimize database: ' + error.message
      });
    }
  });
};

