/**
 * YB News — Supabase Database Seeder
 * 
 * Usage:
 *   node supabase/seed.js
 * 
 * This will populate test data into Supabase for development
 */

require('dotenv').config({ path: '.env' });
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

// Test data
const TEST_USERS = [
  {
    full_name: 'John Doe',
    email: 'codingin19@gmail.com',
    password: 'password',
    is_first_login: false,
  },
  {
    full_name: 'Jane Smith',
    email: 'jane@example.com',
    password: 'JanePass456',
    is_first_login: false,
  },
  {
    full_name: 'Test User',
    email: 'test@example.com',
    password: 'TestPass789',
    is_first_login: true,
  },
];

const TEST_BOOKMARKS = [
  {
    article_url: 'https://example-news.com/article-1',
    article_data: {
      title: 'Breaking: New AI Model Released',
      description: 'A revolutionary new AI model has been released today',
      image: 'https://via.placeholder.com/400x300?text=AI+News',
      source: 'TechNews',
      publishedAt: '2026-02-19T10:00:00Z',
    },
  },
  {
    article_url: 'https://example-news.com/article-2',
    article_data: {
      title: 'Stock Market Hits New High',
      description: 'Global stock markets reach all-time highs',
      image: 'https://via.placeholder.com/400x300?text=Market+News',
      source: 'BusinessDaily',
      publishedAt: '2026-02-19T09:30:00Z',
    },
  },
];

const TEST_LIKES = [
  { article_url: 'https://example-news.com/article-1' },
  { article_url: 'https://example-news.com/article-3' },
];

const TEST_COMMENTS = [
  {
    article_url: 'https://example-news.com/article-1',
    content: 'This is an amazing development in AI technology!',
  },
  {
    article_url: 'https://example-news.com/article-2',
    content: 'Great news for investors. The market is growing strong.',
  },
];

async function seed() {
  console.log('🌱 Starting database seeding...\n');

  try {
    // ─────────────────────────────────────────
    // 1. Seed Users
    // ─────────────────────────────────────────
    console.log('📝 Seeding users...');
    
    const usersWithHashes = await Promise.all(
      TEST_USERS.map(async (user) => ({
        ...user,
        password_hash: await bcrypt.hash(user.password, 12),
      }))
    );

    // Remove plain password field
    const usersToInsert = usersWithHashes.map(({ password, ...rest }) => rest);

    const { data: insertedUsers, error: userError } = await supabase
      .from('users')
      .insert(usersToInsert)
      .select('id, email, full_name');

    if (userError) {
      console.error('❌ Error inserting users:', userError);
      throw userError;
    }

    console.log(`✅ Created ${insertedUsers.length} users`);
    const userIds = insertedUsers.map(u => u.id);

    // ─────────────────────────────────────────
    // 2. Seed Bookmarks (for first user)
    // ─────────────────────────────────────────
    if (userIds.length > 0) {
      console.log('🔖 Seeding bookmarks...');
      
      const bookmarksToInsert = TEST_BOOKMARKS.map(bookmark => ({
        ...bookmark,
        user_id: userIds[0],
      }));

      const { data: insertedBookmarks, error: bookmarkError } = await supabase
        .from('bookmarks')
        .insert(bookmarksToInsert)
        .select('id, article_url');

      if (bookmarkError) {
        console.warn('⚠️  Warning: Could not seed bookmarks (table might not exist yet):', bookmarkError.message);
      } else {
        console.log(`✅ Created ${insertedBookmarks.length} bookmarks`);
      }
    }

    // ─────────────────────────────────────────
    // 3. Seed Likes (for first user)
    // ─────────────────────────────────────────
    if (userIds.length > 0) {
      console.log('👍 Seeding likes...');
      
      const likesToInsert = TEST_LIKES.map(like => ({
        ...like,
        user_id: userIds[0],
      }));

      const { data: insertedLikes, error: likeError } = await supabase
        .from('likes')
        .insert(likesToInsert)
        .select('id, article_url');

      if (likeError) {
        if (likeError.code === '23505') {
          console.log('ℹ️  Some likes already exist');
        } else {
          console.warn('⚠️  Warning: Could not seed likes:', likeError.message);
        }
      } else {
        console.log(`✅ Created ${insertedLikes.length} likes`);
      }
    }

    // ─────────────────────────────────────────
    // 4. Seed Comments (for first user)
    // ─────────────────────────────────────────
    if (userIds.length > 0) {
      console.log('💬 Seeding comments...');
      
      const commentsToInsert = TEST_COMMENTS.map(comment => ({
        ...comment,
        user_id: userIds[0],
      }));

      const { data: insertedComments, error: commentError } = await supabase
        .from('comments')
        .insert(commentsToInsert)
        .select('id, article_url, content');

      if (commentError) {
        console.warn('⚠️  Warning: Could not seed comments:', commentError.message);
      } else {
        console.log(`✅ Created ${insertedComments.length} comments`);
      }
    }

    // ─────────────────────────────────────────
    // Summary
    // ─────────────────────────────────────────
    console.log('\n✨ Database seeding completed!\n');
    console.log('📊 Test Accounts:');
    TEST_USERS.forEach(user => {
      console.log(`   Email: ${user.email} | Password: ${user.password}`);
    });
    console.log('\n💡 Use these credentials to test the application.\n');

  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

// Run seeder
seed();
