/**
 * Migration script to add 'level' column to programs table
 * Run: node scripts/add-level-column.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('🔄 Adding level column to programs table...');

    // Read the migration SQL
    const migrationPath = path.join(__dirname, '../migrations/add_level_to_programs.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration using Supabase RPC or direct query
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(() => {
      // If exec_sql RPC doesn't exist, try using the REST API directly
      return { data: null, error: { message: 'RPC not available, using direct query' } };
    });

    // Alternative: If RPC doesn't work, we need to execute raw SQL
    // This requires the PostgREST admin API or direct database connection
    if (error && error.message.includes('RPC not available')) {
      console.log('⚠️  RPC method not available. You need to run this SQL manually in Supabase SQL Editor:');
      console.log('---');
      console.log(sql);
      console.log('---');
      console.log('\n📝 Steps:');
      console.log('1. Go to your Supabase dashboard');
      console.log('2. Open the SQL Editor');
      console.log('3. Paste and run the SQL above');
      return;
    }

    if (error) {
      console.error('❌ Migration failed:', error.message);
      process.exit(1);
    }

    console.log('✅ Migration completed successfully!');
    console.log('✅ Level column added to programs table');
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    process.exit(1);
  }
}

runMigration();
