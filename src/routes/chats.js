const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Get nearby chats
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 1000 } = req.query; // radius in meters
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    const result = await db.query(
      `SELECT 
        c.*,
        COUNT(cm.id) as comment_count,
        MAX(cm.created_at) as last_activity
       FROM chats c
       LEFT JOIN comments cm ON c.id = cm.chat_id
       WHERE ST_DWithin(
         c.location,
         ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
         $3
       )
       GROUP BY c.id
       ORDER BY last_activity DESC NULLS LAST`,
      [lat, lng, radius]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching nearby chats:', error);
    res.status(500).json({ error: 'Failed to fetch nearby chats' });
  }
});

// Create new chat
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, latitude, longitude } = req.body;
    
    if (!title || !latitude || !longitude) {
      return res.status(400).json({ 
        error: 'Title, latitude, and longitude are required' 
      });
    }

    const result = await db.query(
      `INSERT INTO chats (
        title,
        latitude,
        longitude,
        location
      ) VALUES (
        $1, $2, $3,
        ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography
      ) RETURNING *`,
      [title, latitude, longitude]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

// Get comments for a specific chat
router.get('/:chatId/comments', async (req, res) => {
  try {
    const { chatId } = req.params;

    const result = await db.query(
      `SELECT 
        c.*,
        u.email as author
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.chat_id = $1
       ORDER BY c.created_at ASC`,
      [chatId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching chat comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Add comment to a chat
router.post('/:chatId/comments', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // First verify the chat exists
    const chatExists = await db.query(
      'SELECT id FROM chats WHERE id = $1',
      [chatId]
    );

    if (chatExists.rows.length === 0) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Insert the comment
    const result = await db.query(
      `INSERT INTO comments (
        chat_id,
        user_id,
        content
      ) VALUES ($1, $2, $3)
      RETURNING *`,
      [chatId, userId, content]
    );

    // Fetch the author's email for the response
    const userResult = await db.query(
      'SELECT email FROM users WHERE id = $1',
      [userId]
    );

    const comment = {
      ...result.rows[0],
      author: userResult.rows[0].email
    };

    res.status(201).json(comment);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

module.exports = router; 