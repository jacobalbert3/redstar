const createUsersTable = `
  -- Enable required extensions first
  CREATE EXTENSION IF NOT EXISTS postgis;
  
  -- Try to create vector extension, but don't fail if unavailable
  DO $$ 
  BEGIN 
    CREATE EXTENSION IF NOT EXISTS vector;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'vector extension not available - skipping';
  END $$;

  -- Create users table if it doesn't exist
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    last_location_timestamp TIMESTAMP,
    last_location GEOGRAPHY(POINT),
    is_location_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Create or replace the timestamp update function
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
  END;
  $$ language 'plpgsql';

  -- Drop trigger if it exists, then create it
  DROP TRIGGER IF EXISTS update_users_updated_at ON users;
  
  CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
`;

module.exports = createUsersTable; 