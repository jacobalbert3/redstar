const express = require("express"); //web framework for Node.JS
const bcrypt = require("bcryptjs"); //password hashing library, Converts a plain-text password into a hashed version that's difficult to reverse-engineer.
const jwt = require("jsonwebtoken"); //JSON web token library
const { body, validationResult } = require("express-validator"); //validation library
const dotenv = require("dotenv"); //load environmental variables
const cors = require("cors"); //enable cross origin resource sharing: TODO??
const path = require('path');
const { authenticateToken } = require('./src/middleware/auth');
const socketService = require('./src/services/socketService');


//import local modules:
const db = require('./src/config/db'); //database connection
const incidentRoutes = require('./src/routes/incidents');
const profileRoutes = require('./src/routes/profile');
const chatsRouter = require('./src/routes/chats');
const newsRouter = require('./src/routes/news');



//http is a protocol that allows the exchange of data between a client and a server
const http = require('http');
//socket.io is a library that enables real-time, bidirectional communication between the browser and the server 
const { Server } = require('socket.io');

const { checkRedisHealth } = require('./src/utils/healthCheck');


// Load environment variables
dotenv.config();
//creates an instance of an express application`
const app = express();
//creates an HTTP server that wraps the express application
const server = http.createServer(app);

//creates a new instance of the Socket.IO server, passing in the HTTP server as the argument
const io = new Server(server, {
  //cors is a middleware that allows cross-origin requests
  cors: {
    origin: [
      "http://localhost:9000", 
      "http://localhost:3000", 
      "http://0.0.0.0:9000", 
      "http://127.0.0.1:9000", 
      "http://localhost:8080", 
      "http://localhost",
      "https://*.herokuapp.com"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware for http requests 
app.use(cors({
  origin: [
    "http://localhost:9000", 
    "http://localhost:3000", 
    "http://0.0.0.0:9000", 
    "http://127.0.0.1:9000", 
    "http://localhost:8080", 
    "http://localhost",
    "https://*.herokuapp.com"
  ],
  credentials: true
}));
app.use(express.json());
//why 2 different cors?
//1. cors is used for http requests
//2. socket.io is used for websocket connections


//check health of Redis and Database
app.get('/api/health', async (req, res) => {
  try {
    // Basic app health check
    const appHealth = true;
    
    // Database health check
    let dbHealth = false;
    try {
      await db.query('SELECT 1');
      dbHealth = true;
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    // Redis health check
    const redisHealth = await checkRedisHealth();

    const isHealthy = appHealth && dbHealth && redisHealth;
    
    res.status(isHealthy ? 200 : 500).json({
      status: 'healthy',
      database: dbHealth ? 'connected' : 'disconnected',
      redis: redisHealth ? 'connected' : 'disconnected'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});


app.post("/api/register", [
  body("email").isEmail().withMessage("Invalid email address"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    console.log('Received registration request for:', email);

    // Validate input
    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user exists
    const userExists = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      console.log('User already exists:', email);
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    console.log('Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    console.log('Inserting new user...');
    const result = await db.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, hashedPassword]
    );

    console.log('User inserted:', result.rows[0]);

    // Generate token
    console.log('Generating JWT token...');
    const token = jwt.sign(
      { userId: result.rows[0].id, email: result.rows[0].email },
      process.env.JWT_SECRET
    );

    console.log('Registration successful, sending response');
    res.status(201).json({
      token,
      user: { id: result.rows[0].id, email: result.rows[0].email }
    });

  } catch (error) {
    console.error('Server registration error:', error);
    res.status(500).json({ 
      error: 'Failed to register',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Input validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Get user from database
    const result = await db.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Compare password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Generated token:', token); // Debug log

    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Add this route near your other authentication routes
app.get('/api/verify-token', authenticateToken, (req, res) => {
  res.json({ 
    valid: true,
    user: {
      id: req.user.id,
      email: req.user.email
    }
  });
});

// Add routes
app.use('/api/incidents', incidentRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/news', newsRouter);
app.use('/api/chats', chatsRouter);

// Serve static files in production ****!!!!!
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('public'));
  
  //catch all route for react router
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}


//accepts a socket instance as an argument
const setupSocketHandlers = (io) => {
  //set up event listener for new socket connections:
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Authenticate socket connection
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      console.log('No token provided for socket connection');
      socket.disconnect();
      return;
    }

    try {
      // Verify and decode the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userEmail = decoded.email;
      console.log('Socket authenticated for user:', decoded.email);

      // Join a room specific to this user
      socket.join(`user_${decoded.userId}`);

      // Handle initial friend locations request
      socket.on('get-friend-locations', async () => {
        try {
          const result = await db.query(`
            SELECT DISTINCT
              u.id,
              u.email,
              ST_X(u.last_location::geometry) as longitude,
              ST_Y(u.last_location::geometry) as latitude,
              u.last_location_timestamp,
              u.is_location_enabled
            FROM users u
            INNER JOIN friends f ON 
              (f.friend_id = u.id OR f.user_id = u.id)
            WHERE (f.user_id = $1 OR f.friend_id = $1)
              AND u.id != $1
              AND u.is_location_enabled = true
              AND u.last_location IS NOT NULL`,
            [socket.userId]
          );
          console.log('Friend locations fetched:', result.rows);
          socket.emit('friend-locations', result.rows);
        } catch (error) {
          console.error('Error fetching friend locations:', error);
          socket.emit('error', 'Failed to fetch friend locations');
        }
      });
      
      // Handle location updates
      socket.on('update-location', async (location) => {
        try {
          // Update user's location in database
          await db.query(`
            UPDATE users 
            SET last_location = ST_SetSRID(ST_MakePoint($1, $2), 4326),
                last_location_timestamp = CURRENT_TIMESTAMP
            WHERE id = $3 AND is_location_enabled = true`,
            [location.longitude, location.latitude, socket.userId]
          );

          // Fetch and notify friends who have location enabled
          const friendsResult = await db.query(`
            SELECT DISTINCT
              CASE 
                WHEN f.user_id = $1 THEN f.friend_id
                ELSE f.user_id
              END as friend_id
            FROM friends f
            INNER JOIN users u ON 
              (CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END) = u.id
            WHERE (f.user_id = $1 OR f.friend_id = $1)
              AND u.is_location_enabled = true`,
            [socket.userId]
          );

          // Emit location update to all friends
          friendsResult.rows.forEach(friend => {
            io.to(`user_${friend.friend_id}`).emit('friend-location-update', {
              userId: socket.userId,
              email: socket.userEmail,
              latitude: location.latitude,
              longitude: location.longitude,
              timestamp: new Date()
            });
          });
        } catch (error) {
          console.error('Error updating location:', error);
          socket.emit('error', 'Failed to update location');
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.userEmail);
      });

    } catch (error) {
      console.error('Socket authentication error:', error);
      socket.disconnect();
    }
  });
};

// Set up socket handlers
setupSocketHandlers(io);

socketService.init(io);



//Setting up port so that the server can listen for incoming requests
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', (err) => {
  if (err) {
    console.error('Error starting server:', err);
    return;
  }
  console.log(`Server running on port ${PORT}`);
});

//unhandled rejection:
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Export io instance
module.exports = { app, io };
