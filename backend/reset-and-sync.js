/**
 * reset-and-sync.js
 * Deletes all POSTS (and their video sources, actors, category links)
 * then does a fresh sync from SeekStreaming + Streamtape.
 * Channels, actors, categories are KEPT.
 * Run with:  node backend/reset-and-sync.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const syncService = require('./src/services/syncService');

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║       Delete All Posts + Fresh Sync                  ║');
  console.log('║       (Channels/Actors/Categories kept intact)       ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  // ── Count before ─────────────────────────────────────────────────────────
  const { count: postCount } = await supabase.from('posts').select('*', { count: 'exact', head: true });
  const { count: vsCount }   = await supabase.from('post_video_sources').select('*', { count: 'exact', head: true });
  console.log(`📊  Before: ${postCount} posts, ${vsCount} video sources`);
  console.log('');

  // ── Step 1: Delete child tables first (FK order) ─────────────────────────
  console.log('🗑️   Deleting post_video_sources...');
  const { error: vsErr } = await supabase
    .from('post_video_sources')
    .delete()
    .neq('post_id', '00000000-0000-0000-0000-000000000000');
  if (vsErr) console.warn('  ⚠️ ', vsErr.message);
  else console.log('  ✓ Done');

  console.log('🗑️   Deleting post_actors...');
  const { error: paErr } = await supabase
    .from('post_actors')
    .delete()
    .neq('post_id', '00000000-0000-0000-0000-000000000000');
  if (paErr) console.warn('  ⚠️ ', paErr.message);
  else console.log('  ✓ Done');

  console.log('🗑️   Deleting post_categories...');
  const { error: pcErr } = await supabase
    .from('post_categories')
    .delete()
    .neq('post_id', '00000000-0000-0000-0000-000000000000');
  if (pcErr) console.warn('  ⚠️ ', pcErr.message);
  else console.log('  ✓ Done');

  console.log('🗑️   Deleting posts...');
  const { error: postsErr } = await supabase
    .from('posts')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (postsErr) console.warn('  ⚠️ ', postsErr.message);
  else console.log('  ✓ Done');

  const { count: afterPosts } = await supabase.from('posts').select('*', { count: 'exact', head: true });
  console.log('');
  console.log(`✅  Posts remaining: ${afterPosts ?? 0}`);
  console.log('');

  // ── Step 2: Fresh sync ────────────────────────────────────────────────────
  console.log('🔄  Starting fresh sync (all SeekStreaming pages + Streamtape)...');
  console.log('');

  try {
    const result = await syncService.sync();
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║                Sync Complete ✅                      ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`    Posts added   : ${result.added}`);
    console.log(`    Posts skipped : ${result.skipped}`);
    console.log('');

    const { count: finalPosts } = await supabase.from('posts').select('*', { count: 'exact', head: true });
    const { count: finalVS }    = await supabase.from('post_video_sources').select('*', { count: 'exact', head: true });
    const { count: finalChans } = await supabase.from('channels').select('*', { count: 'exact', head: true });
    console.log('📊  Final state:');
    console.log(`    posts              : ${finalPosts}`);
    console.log(`    post_video_sources : ${finalVS}`);
    console.log(`    channels           : ${finalChans} (unchanged)`);
    console.log('');
    console.log('🎉  All done!');
  } catch (err) {
    console.error('❌  Sync failed:', err.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
