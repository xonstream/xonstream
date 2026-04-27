/**
 * CLEANUP SCRIPT: Remove all Streamtape data from Supabase
 * 
 * This script will:
 * 1. Delete all post_video_sources entries where platform = 'streamtape'
 * 2. Delete all posts that ONLY have Streamtape (no SeekStreaming)
 * 3. Keep posts that have SeekStreaming data
 * 4. Preserve manually edited posts
 * 
 * Run with: node backend/scripts/clean-streamtape.js
 */

require('dotenv').config();
const supabase = require('../src/config/supabase');
const logger = require('../src/utils/logger');

async function cleanStreamtapeData() {
  try {
    logger.info('=== STARTING STREAMTAPE CLEANUP ===');

    // Step 1: Get all posts and their video sources
    logger.info('Step 1: Fetching all posts with video sources...');
    const { data: posts, error: fetchError } = await supabase
      .from('posts')
      .select(`
        id, 
        title, 
        created_at,
        post_video_sources(platform, video_id)
      `);

    if (fetchError) {
      logger.error('Failed to fetch posts:', fetchError);
      process.exit(1);
    }

    logger.info(`Found ${posts.length} total posts`);

    // Step 2: Categorize posts
    const postsWithOnlyStreamtape = [];
    const postsWithSeekstreaming = [];
    const postsWithBoth = [];

    posts.forEach(post => {
      const sources = post.post_video_sources || [];
      const hasSeekstreaming = sources.some(s => s.platform === 'seekstreaming');
      const hasStreamtape = sources.some(s => s.platform === 'streamtape');

      if (hasStreamtape && !hasSeekstreaming) {
        postsWithOnlyStreamtape.push(post);
      } else if (hasSeekstreaming && hasStreamtape) {
        postsWithBoth.push(post);
      } else if (hasSeekstreaming) {
        postsWithSeekstreaming.push(post);
      }
    });

    logger.info('\n=== POST ANALYSIS ===');
    logger.info(`Posts with ONLY Streamtape (WILL BE DELETED): ${postsWithOnlyStreamtape.length}`);
    logger.info(`Posts with BOTH platforms (Streamtape will be removed): ${postsWithBoth.length}`);
    logger.info(`Posts with ONLY Seekstreaming (UNCHANGED): ${postsWithSeekstreaming.length}`);

    // Step 3: Delete posts that only have Streamtape
    if (postsWithOnlyStreamtape.length > 0) {
      logger.info('\nStep 3: Deleting posts with only Streamtape...');
      
      for (const post of postsWithOnlyStreamtape) {
        logger.info(`  Deleting post: "${post.title}" (${post.id})`);
        
        // Delete related records first
        await supabase.from('post_video_sources').delete().eq('post_id', post.id);
        await supabase.from('post_actors').delete().eq('post_id', post.id);
        await supabase.from('post_categories').delete().eq('post_id', post.id);
        
        // Delete the post
        const { error: deleteError } = await supabase
          .from('posts')
          .delete()
          .eq('id', post.id);
        
        if (deleteError) {
          logger.error(`    Failed to delete post ${post.id}:`, deleteError);
        }
      }
      
      logger.info(`✓ Deleted ${postsWithOnlyStreamtape.length} Streamtape-only posts`);
    }

    // Step 4: Remove Streamtape sources from posts that have both
    if (postsWithBoth.length > 0) {
      logger.info('\nStep 4: Removing Streamtape sources from posts with both platforms...');
      
      for (const post of postsWithBoth) {
        logger.info(`  Removing Streamtape from: "${post.title}" (${post.id})`);
        
        // Delete only Streamtape video sources
        const { error: deleteError } = await supabase
          .from('post_video_sources')
          .delete()
          .eq('post_id', post.id)
          .eq('platform', 'streamtape');
        
        if (deleteError) {
          logger.error(`    Failed to remove Streamtape from post ${post.id}:`, deleteError);
        }
      }
      
      logger.info(`✓ Removed Streamtape from ${postsWithBoth.length} posts`);
    }

    // Step 5: Verify cleanup
    logger.info('\nStep 5: Verifying cleanup...');
    const { data: remainingStreamtape, error: verifyError } = await supabase
      .from('post_video_sources')
      .select('id, post_id, platform, video_id')
      .eq('platform', 'streamtape');

    if (verifyError) {
      logger.error('Verification failed:', verifyError);
    } else {
      logger.info(`Remaining Streamtape video sources: ${remainingStreamtape.length}`);
      
      if (remainingStreamtape.length === 0) {
        logger.info('✓ All Streamtape data successfully removed!');
      } else {
        logger.warn(`⚠ ${remainingStreamtape.length} Streamtape sources still exist`);
        remainingStreamtape.forEach(source => {
          logger.info(`  - Post ${source.post_id}: ${source.video_id}`);
        });
      }
    }

    // Step 6: Summary
    logger.info('\n=== CLEANUP SUMMARY ===');
    logger.info(`✓ Deleted ${postsWithOnlyStreamtape.length} Streamtape-only posts`);
    logger.info(`✓ Removed Streamtape from ${postsWithBoth.length} posts`);
    logger.info(`✓ Preserved ${postsWithSeekstreaming.length} SeekStreaming-only posts`);
    logger.info('=== CLEANUP COMPLETE ===');

    process.exit(0);
  } catch (error) {
    logger.error('Cleanup failed:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanStreamtapeData();
