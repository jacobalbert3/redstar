const createCommentsTable = `
  -- Create chats table for grouping comments by location
  CREATE TABLE IF NOT EXISTS chats (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(POINT) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Create spatial index on chats location
  CREATE INDEX IF NOT EXISTS chats_location_idx ON chats USING GIST (location);

  -- Comments table for storing user comments in chats
  CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Create indexes
  CREATE INDEX IF NOT EXISTS comments_chat_id_idx ON comments(chat_id);
  CREATE INDEX IF NOT EXISTS comments_user_id_idx ON comments(user_id);
`;

module.exports = createCommentsTable; 