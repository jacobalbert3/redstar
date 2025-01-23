const createCoreTables = `

  -- Create updated_at function if it doesn't exist
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
  END;
  $$ language 'plpgsql';

  -- Create incidents table
  CREATE TABLE IF NOT EXISTS incidents (
    id SERIAL PRIMARY KEY,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(POINT) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    severity INTEGER CHECK (severity >= 1 AND severity <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Create spatial index on location
  CREATE INDEX IF NOT EXISTS incidents_location_idx 
    ON incidents USING GIST (location);

  -- Create index on created_at for time-based queries
  CREATE INDEX IF NOT EXISTS incidents_created_at_idx 
    ON incidents(created_at);


  -- Add friends table
  CREATE TABLE IF NOT EXISTS friends (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, friend_id),
    CHECK (user_id != friend_id)
  );

  -- Create index for faster friend lookups
  CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
  CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);

  -- Add friend requests table
  CREATE TABLE IF NOT EXISTS friend_requests (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sender_id, receiver_id),
    CHECK (sender_id != receiver_id)
  );

  -- Create indexes for faster lookups
  CREATE INDEX IF NOT EXISTS idx_requests_sender ON friend_requests(sender_id);
  CREATE INDEX IF NOT EXISTS idx_requests_receiver ON friend_requests(receiver_id);
  CREATE INDEX IF NOT EXISTS idx_requests_status ON friend_requests(status);
`;

module.exports = createCoreTables; 