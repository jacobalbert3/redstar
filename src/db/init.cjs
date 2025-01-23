const db = require('../config/db');
const createUsersTable = require('./migrations/001_create_users_table');
const createCoreTables = require('./migrations/002_create_core_tables');
const createCommentsTable = require('./migrations/003_create_comments_table');
const bcrypt = require('bcryptjs');

async function createTestUser() {
  try {
    const hashedPassword = await bcrypt.hash('testpass123', 10);
    await db.query(
      `INSERT INTO users (email, password_hash) 
       VALUES ($1, $2) 
       ON CONFLICT (email) DO NOTHING`,
      ['test@example.com', hashedPassword]
    );
    console.log('Test user created or already exists');
  } catch (error) {
    console.error('Error creating test user:', error);
  }
}

async function initializeDatabase() {
  try {
    console.log('Starting database initialization...');
    console.log('Database URL:', process.env.DATABASE_URL);
    console.log('Node ENV:', process.env.NODE_ENV);
    
    // Create tables in the correct order
    console.log('Creating users table...');
    await db.query(createUsersTable);
    
    console.log('Creating core tables...');
    await db.query(createCoreTables);
    
    console.log('Creating comments table...');
    await db.query(createCommentsTable);

    // Create test user
    await createTestUser();
    
    console.log('Database initialization completed');
  } catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

// Run the initialization
initializeDatabase().catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}); 