const axios = require('axios');
const db = require('../config/db');

jest.setTimeout(30000); // Increase timeout to 30 seconds

describe('Basic Server Test', () => {
  beforeAll(async () => {
    // Wait for database to be ready
    let retries = 10;
    while (retries > 0) {
      try {
        await db.query('SELECT 1');
        console.log('Database connection successful');
        break;
      } catch (error) {
        console.log(`Database connection attempt failed, retries left: ${retries}`);
        retries--;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    if (retries === 0) {
      throw new Error('Could not connect to database after multiple attempts');
    }
  });

  test('should register test user', async () => {
    const testUser = {
      email: `test${Date.now()}@example.com`,
      password: 'testpass123'
    };

    try {
      const response = await axios.post('http://localhost:3000/api/register', testUser);
      console.log('Registration response:', response.data);
      
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('token');
      expect(response.data.user.email).toBe(testUser.email);

      // Query the database directly using pg
      const dbResponse = await db.query(
        'SELECT * FROM users WHERE email = $1',
        [testUser.email]
      );
      const user = dbResponse.rows[0];
      
      expect(user).toBeTruthy();
      expect(user.email).toBe(testUser.email);
    } catch (error) {
      console.error('Test failed:', error.response?.data || error.message);
      throw error;
    }
  });

  afterAll(async () => {
    await db.end();
  });
}); 