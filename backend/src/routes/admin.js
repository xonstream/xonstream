const supabase = require('../config/supabase');
const cacheService = require('../services/cacheService');
const syncService = require('../services/syncService');
const logger = require('../utils/logger');

module.exports = async (fastify, opts) => {
  // Add auth hook for all routes except test-sync
  fastify.addHook('onRequest', async (request, reply) => {
    // Skip auth for test-sync endpoint
    if (request.url === '/api/admin/test-sync') {
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
      const seekstreamingService = require('../services/seekstreaming');

      let streamtapeFiles = [];
      let seekstreamingVideos = [];

      try {
        streamtapeFiles = await streamtapeService.getAllFiles();
        logger.info(`Streamtape API: Found ${streamtapeFiles.length} files`);
      } catch (e) {
        logger.error('Streamtape API error:', e.message);
      }

      try {
        seekstreamingVideos = await seekstreamingService.getAllVideos();
        logger.info(`SeekStreaming API: Found ${seekstreamingVideos.length} videos`);
      } catch (e) {
        logger.error('SeekStreaming API error:', e.message);
      }

      return reply.send({
        success: true,
        streamtape: {
          fileCount: streamtapeFiles.length,
          files: streamtapeFiles.slice(0, 3)
        },
        seekstreaming: {
          videoCount: seekstreamingVideos.length,
          videos: seekstreamingVideos.slice(0, 3)
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
        
        return {
          id: post.id,
          title: post.title,
          thumbnail: post.thumbnail || '',
          channelName: post.channel?.name || '',
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

  fastify.post('/api/admin/sync', async (request, reply) => {
    try {
      const result = await syncService.sync();

      return reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error during sync', error);
      return reply.status(500).send({
        success: false,
        message: 'Sync failed'
      });
    }
  });

  fastify.post('/api/admin/posts', async (request, reply) => {
    try {
      const {
        title,
        description,
        actors,
        channelId,
        categoryIds,
        categoryId,
        thumbnail,
        videoSources
      } = request.body || {};

      logger.info('=== CREATING POST ===');
      logger.info('Title:', title);
      logger.info('Channel ID:', channelId);
      logger.info('Category IDs:', categoryIds);
      logger.info('Category ID (single):', categoryId);
      logger.info('Actors received:', actors);
      logger.info('Actors type:', typeof actors, Array.isArray(actors) ? `(length: ${actors.length})` : '');
      logger.info('Actors JSON:', JSON.stringify(actors));
      logger.info('Video Sources:', videoSources);
      logger.info('=====================');

      if (!title) {
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
          title: title.trim(),
          description: description || '',
          thumbnail: thumbnail || '',
          channel_id: channelId || null,
          category_id: firstCategoryId
        })
        .select()
        .single();

      if (postError) {
        logger.error('Error creating post in Supabase', postError);
        return reply.status(500).send({
          success: false,
          message: 'Failed to create post: ' + postError.message
        });
      }

      logger.info('Post created successfully with ID:', post.id);

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

      // Insert actor relationships (ONLY ONCE - removed duplicate)
      if (post && actors && actors.length > 0) {
        logger.info(`Linking ${actors.length} actors to post ${post.id}`);
        
        // Look up actor IDs by name (actors array contains names, not IDs)
        const { data: actorRecords, error: actorLookupError } = await supabase
          .from('actors')
          .select('id, name')
          .in('name', actors);
        
        if (actorLookupError) {
          logger.error('Error looking up actor IDs', actorLookupError);
        } else if (actorRecords && actorRecords.length > 0) {
          // Insert into post_actors junction table
          const actorInserts = actorRecords.map(actor => ({
            post_id: post.id,
            actor_id: actor.id
          }));
          
          const { error: actorInsertError } = await supabase
            .from('post_actors')
            .insert(actorInserts);
          
          if (actorInsertError) {
            logger.error('Error inserting actor relationships', actorInsertError);
          } else {
            logger.info(`Successfully linked ${actorInserts.length} actors to post`);
          }
        } else {
          logger.warn(`No actors found in database for names:`, actors);
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

      cacheService.invalidateAllPosts();
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

      const allowedUpdates = ['title', 'description', 'actors', 'channelId', 'categoryIds', 'categoryId', 'thumbnail', 'videoSources'];
      const updateData = {};

      if (updates.title !== undefined) updateData.title = updates.title.trim();
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.actors !== undefined) updateData.actors = updates.actors;
      if (updates.channelId !== undefined) updateData.channel = updates.channelId;
      // Support both categoryIds (array) and categoryId (single)
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

      // Build update object for Supabase
      const updateFields = {};
      if (updateData.title !== undefined) updateFields.title = updateData.title;
      if (updateData.description !== undefined) updateFields.description = updateData.description;
      if (updateData.thumbnail !== undefined) updateFields.thumbnail = updateData.thumbnail;
      if (updateData.channel !== undefined) {
        // Convert empty string to null for channel_id
        updateFields.channel_id = updateData.channel === '' ? null : updateData.channel;
        logger.info(`Updating post ${id} channel to:`, updateFields.channel_id);
      }
      if (updateData.category !== undefined) {
        // Convert empty string to null for category_id
        updateFields.category_id = updateData.category === '' ? null : updateData.category;
        logger.info(`Updating post ${id} category to:`, updateFields.category_id);
      }

      logger.info(`Updating post ${id} with fields:`, Object.keys(updateFields));
      logger.info(`Update fields data:`, JSON.stringify(updateFields, null, 2));
      logger.info(`updateData keys:`, Object.keys(updateData));

      // Check if we have ANYTHING to update (including categories, actors, videoSources)
      const hasAnyUpdates = Object.keys(updateData).length > 0;
      const hasPostFieldUpdates = Object.keys(updateFields).length > 0;
      
      logger.info(`Has any updates: ${hasAnyUpdates}, Has post field updates: ${hasPostFieldUpdates}`);

      // If no fields to update in posts table, but we might have categories/actors/videosources to update
      // Only return error if there's truly nothing to update
      if (!hasAnyUpdates) {
        logger.warn(`No valid fields to update for post ${id}`);
        return reply.status(400).send({
          success: false,
          message: 'No valid fields to update'
        });
      }

      // Update the posts table ONLY if we have post fields to update
      let updatedPost = null;
      if (hasPostFieldUpdates) {
        const { data: post, error } = await supabase
          .from('posts')
          .update(updateFields)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          logger.error(`Supabase error updating post ${id}:`, JSON.stringify(error, null, 2));
          logger.error(`Update fields that caused error:`, JSON.stringify(updateFields, null, 2));
          return reply.status(400).send({
            success: false,
            message: `Update failed: ${error.message || 'Database error'}`,
            error: error.message,
            details: error
          });
        }
        
        if (!post) {
          logger.error(`No post returned after updating ${id}. Post ID might not exist.`);
          return reply.status(404).send({
            success: false,
            message: `Post with ID ${id} not found in database`
          });
        }

        updatedPost = post;
        logger.info(`Successfully updated post ${id}`);
      } else {
        // Fetch the post anyway for the response
        const { data: post, error } = await supabase
          .from('posts')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error || !post) {
          return reply.status(404).send({
            success: false,
            message: `Post with ID ${id} not found in database`
          });
        }
        
        updatedPost = post;
        logger.info(`Post ${id} fetched (no post fields to update, only relations)`);
      }

      // Update actors if provided
      if (updateData.actors !== undefined) {
        logger.info(`Updating actors for post ${id}:`, updateData.actors);
        
        // Delete existing relations
        await supabase.from('post_actors').delete().eq('post_id', id);
        
        // Insert new relations
        if (updateData.actors.length > 0) {
          // Actors might be names or IDs - look up IDs if they're names
          let actorIds = updateData.actors;
          
          // Check if actors are names (strings) instead of IDs (UUIDs)
          // UUIDs contain dashes, names don't
          if (updateData.actors.length > 0 && typeof updateData.actors[0] === 'string' && !updateData.actors[0].includes('-')) {
            // These are actor names, look up their IDs
            logger.info('Looking up actor IDs by names:', updateData.actors);
            const { data: actorRecords, error: actorLookupError } = await supabase
              .from('actors')
              .select('id, name')
              .in('name', updateData.actors);
            
            if (actorLookupError) {
              logger.error('Error looking up actor IDs', actorLookupError);
            } else {
              logger.info('Found actor records:', actorRecords);
              actorIds = actorRecords.map(a => a.id);
              
              // Check if all actors were found
              if (actorIds.length !== updateData.actors.length) {
                const foundNames = actorRecords.map(a => a.name);
                const missingNames = updateData.actors.filter(name => !foundNames.includes(name));
                logger.warn('Some actors not found in database:', missingNames);
              }
            }
          }
          
          if (actorIds.length > 0) {
            const actorInserts = actorIds.map(actorId => ({
              post_id: id,
              actor_id: actorId
            }));
            const { error: insertError } = await supabase.from('post_actors').insert(actorInserts);
            if (insertError) {
              logger.error('Error inserting actor relations', insertError);
            } else {
              logger.info(`Successfully inserted ${actorInserts.length} actor relations`);
            }
          } else {
            logger.warn('No actor IDs to insert');
          }
        }
      }

      // Update categories if provided
      if (updateData.categories !== undefined) {
        logger.info(`=== UPDATING CATEGORIES FOR POST ${id} ===`);
        logger.info(`Categories array:`, updateData.categories);
        logger.info(`Categories type: ${typeof updateData.categories}, isArray: ${Array.isArray(updateData.categories)}`);
        logger.info(`Categories length: ${updateData.categories.length}`);
        
        // Also update posts.category_id with first category (backward compatibility)
        if (updateData.categories.length > 0) {
          updateFields.category_id = updateData.categories[0];
          logger.info(`Setting posts.category_id to first category:`, updateData.categories[0]);
        } else {
          updateFields.category_id = null;
          logger.info(`Clearing posts.category_id (no categories)`);
        }
        
        // Update the posts table if we modified category_id
        if (Object.keys(updateFields).length > 0 && !hasPostFieldUpdates) {
          // Only update if we haven't already updated the post above
          const { data: post, error: updateError } = await supabase
            .from('posts')
            .update(updateFields)
            .eq('id', id)
            .select()
            .single();
          
          if (updateError) {
            logger.error(`Error updating posts.category_id for post ${id}:`, updateError);
          } else {
            logger.info(`Successfully updated posts.category_id`);
            updatedPost = post;
          }
        }
        
        try {
          // Delete existing category relations
          logger.info(`Deleting existing category relations for post ${id}`);
          const { error: deleteError } = await supabase.from('post_categories').delete().eq('post_id', id);
          
          if (deleteError) {
            logger.error('Error deleting old category relations:', deleteError);
            // Continue anyway - table might not exist yet
          } else {
            logger.info('Deleted old category relations');
          }
          
          // Insert new category relations
          if (updateData.categories.length > 0) {
            const categoryInserts = updateData.categories.map(categoryId => ({
              post_id: id,
              category_id: categoryId
            }));
            
            logger.info('Inserting category relations:', categoryInserts);
            
            const { error: insertError, data: insertData } = await supabase.from('post_categories').insert(categoryInserts);
            
            if (insertError) {
              logger.error('Error inserting category relations:', insertError);
              logger.error('Insert error details:', JSON.stringify(insertError, null, 2));
            } else {
              logger.info(`Successfully inserted ${categoryInserts.length} category relations`);
              logger.info('Insert result:', insertData);
            }
          } else {
            logger.info('No categories to insert (empty array)');
          }
        } catch (error) {
          logger.error('Exception during category update:', error);
          logger.error('Error message:', error.message);
          logger.error('Error stack:', error.stack);
        }
        
        logger.info(`=== CATEGORY UPDATE COMPLETE FOR POST ${id} ===`);
      }

      // Update video sources if provided
      if (updateData.videoSources !== undefined) {
        logger.info(`Updating video sources for post ${id}:`, updateData.videoSources);
        
        // Delete existing video sources
        await supabase.from('post_video_sources').delete().eq('post_id', id);
        
        // Insert new video sources
        if (updateData.videoSources.length > 0) {
          const videoSourceInserts = updateData.videoSources.map(vs => ({
            post_id: id,
            platform: vs.platform,
            video_id: vs.videoId
          }));
          
          const { error: vsError } = await supabase
            .from('post_video_sources')
            .insert(videoSourceInserts);
          
          if (vsError) {
            logger.error('Error inserting video sources', vsError);
          } else {
            logger.info(`Successfully inserted ${videoSourceInserts.length} video sources`);
          }
        }
      }

      cacheService.invalidatePostCache(id);
      cacheService.invalidateActors();

      // Invalidate cache after successful update
      cacheService.invalidateAllPosts();
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

      cacheService.invalidatePostCache(id);

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
            const { error } = await supabase
              .from('posts')
              .update(updateFields)
              .eq('id', postId);
            
            if (error) {
              logger.error(`Error updating post ${postId}`, error);
              errors.push({ postId, error: error.message });
              errorCount++;
            } else {
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

      cacheService.invalidateAllPosts();
      cacheService.invalidateActors();

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
      if (name !== undefined) updateData.name = name.trim();
      if (image !== undefined) updateData.image = image;
      if (bio !== undefined) updateData.bio = bio;

      const { data: actor, error } = await supabase
        .from('actors')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error || !actor) {
        return reply.status(404).send({
          success: false,
          message: 'Actor not found'
        });
      }

      cacheService.invalidateActors();

      return reply.send({
        success: true,
        data: actor
      });
    } catch (error) {
      logger.error(`Error updating actor ${request.params.id}`, error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to update actor'
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
};
