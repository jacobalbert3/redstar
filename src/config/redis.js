const Redis = require('ioredis');

//ioredis is a popular Node.js libary for interacting with Redis
let redisConfig;

//check if the REDISCLOUD_URL environment variable is set (in Heroku)
if (process.env.REDISCLOUD_URL) {
  // Use Redis Cloud URL in production
  redisConfig = process.env.REDISCLOUD_URL;
} else {
  // Use local config in development
  redisConfig = {
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
  };
}
//can take either a connection string or a config object
const redis = new Redis(redisConfig);

//add event listeners to the redis connection
redis.on('error', (error) => {
  console.error('Redis connection error:', error);
});

redis.on('connect', () => {
  console.log('Successfully connected to Redis');
});

module.exports = { redis }; 