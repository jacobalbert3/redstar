const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/db');

// Get friends list
router.get('/friends', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await db.query(`
      SELECT 
        u.id, 
        u.email,
        u.is_location_enabled,
        CASE 
          WHEN u.is_location_enabled = true THEN ST_X(u.last_location::geometry)
          ELSE NULL
        END as longitude,
        CASE 
          WHEN u.is_location_enabled = true THEN ST_Y(u.last_location::geometry)
          ELSE NULL
        END as latitude,
        u.last_location_timestamp
      FROM users u
      INNER JOIN friends f ON (f.friend_id = u.id)
      WHERE f.user_id = $1
    `, [userId]);

    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// Get friend requests
router.get('/requests', authenticateToken, async (req, res) => {
  try {
    // Get received requests
    const receivedResult = await db.query(
      `SELECT fr.id, u.email as sender_email
       FROM friend_requests fr
       INNER JOIN users u ON fr.sender_id = u.id
       WHERE fr.receiver_id = $1 AND fr.status = 'pending'`,
      [req.user.userId]
    );

    // Get sent requests
    const sentResult = await db.query(
      `SELECT fr.id, u.email as receiver_email
       FROM friend_requests fr
       INNER JOIN users u ON fr.receiver_id = u.id
       WHERE fr.sender_id = $1 AND fr.status = 'pending'`,
      [req.user.userId]
    );

    res.json({
      received: receivedResult.rows,
      sent: sentResult.rows
    });
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send friend request
router.post('/send-request', authenticateToken, async (req, res) => {
  try {
    const { email } = req.body;
    
    // Get receiver's user ID
    const userResult = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const receiverId = userResult.rows[0].id;

    // Check if trying to send request to self
    if (receiverId === req.user.userId) {
      return res.status(400).json({ message: 'Cannot send friend request to yourself' });
    }

    // Check if already friends
    const friendshipCheck = await db.query(
      'SELECT * FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
      [req.user.userId, receiverId]
    );

    if (friendshipCheck.rows.length > 0) {
      // Just return a message, don't modify any data
      return res.status(400).json({ message: 'You are already friends with this user' });
    }
    //check if the user has already sent a request to the receiver
    const existingRequest = await db.query(
      'SELECT * FROM friend_requests WHERE status = $1 AND (sender_id = $2 AND receiver_id = $3) OR (sender_id = $3 AND receiver_id = $2)',
      ['pending', req.user.userId, receiverId]
    );

    if (existingRequest.rows.length > 0) {
      return res.status(400).json({ message: 'You have already sent a friend request to this user' });
    }

    // Continue with friend request if not already friends
    await db.query(
      'INSERT INTO friend_requests (sender_id, receiver_id) VALUES ($1, $2)',
      [req.user.userId, receiverId]
    );

    res.json({ message: 'Friend request sent successfully' });
  } catch (error) {
    console.error('Error details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Respond to friend request
router.post('/respond-request', authenticateToken, async (req, res) => {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    
    const { requestId, action } = req.body;
    const status = action === 'accept' ? 'accepted' : 'rejected';
    
    console.log('Processing request:', { requestId, status, userId: req.user.userId });

    const requestResult = await client.query(
      `SELECT fr.*, 
              sender.email as sender_email,
              receiver.email as receiver_email
       FROM friend_requests fr
       JOIN users sender ON fr.sender_id = sender.id
       JOIN users receiver ON fr.receiver_id = receiver.id
       WHERE fr.id = $1 AND fr.receiver_id = $2`,
      [requestId, req.user.userId]
    );

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Friend request not found' });
    }

    const request = requestResult.rows[0];

    if (status === 'accepted') {
      console.log('Accepting request - creating friendship');
      
      await client.query(
        `INSERT INTO friends (user_id, friend_id) 
         VALUES ($1, $2), ($2, $1)
         ON CONFLICT DO NOTHING`,
        [request.receiver_id, request.sender_id]
      );
    }

    await client.query(
      'UPDATE friend_requests SET status = $1 WHERE id = $2',
      [status, requestId]
    );

    await client.query('COMMIT');
    console.log('Transaction committed successfully');
    res.json({ message: `Friend request ${action}ed successfully` });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Detailed error:', {
      message: error.message,
      stack: error.stack,
      detail: error.detail,
      code: error.code
    });
    res.status(500).json({ 
      error: 'Internal server error',
      detail: error.message
    });
  } finally {
    client.release();
  }
});

// Location toggle route (existing)
router.post('/location-toggle', authenticateToken, async (req, res) => {
  console.log('Location toggle endpoint hit');
  try {
    const { enabled } = req.body;
    const userId = req.user.userId;

    console.log('Updating location status:', { userId, enabled });

    await db.query(
      'UPDATE users SET is_location_enabled = $1 WHERE id = $2',
      [enabled, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error toggling location:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add this new route to get location status
router.get('/location-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await db.query(
      'SELECT is_location_enabled FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length > 0) {
      res.json({ isLocationEnabled: result.rows[0].is_location_enabled });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Error fetching location status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Location update route
router.post('/location-update', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const userId = req.user.userId;

    console.log('Received location update:', { userId, latitude, longitude }); // Debug log

    const result = await db.query(`
      UPDATE users 
      SET last_location = ST_SetSRID(ST_MakePoint($1, $2), 4326),
          last_location_timestamp = CURRENT_TIMESTAMP
      WHERE id = $3 AND is_location_enabled = true
      RETURNING id, email, is_location_enabled, 
        ST_X(last_location::geometry) as longitude,
        ST_Y(last_location::geometry) as latitude,
        last_location_timestamp`,
      [longitude, latitude, userId]
    );

    console.log('Database update result:', result.rows[0]); // Debug log

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// Add this new route to get location state
router.get('/location-state', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await db.query(`
      SELECT is_location_enabled
      FROM users
      WHERE id = $1
    `, [userId]);

    res.json({ 
      is_location_enabled: result.rows[0]?.is_location_enabled || false 
    });
  } catch (error) {
    console.error('Error fetching location state:', error);
    res.status(500).json({ error: 'Failed to fetch location state' });
  }
});

module.exports = router; 