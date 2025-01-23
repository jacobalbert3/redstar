const { redis } = require('../config/redis');

async function checkRedisHealth() {
  try {
    await redis.ping();
    console.log('Redis health passed!');
    return true;
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}

module.exports = { checkRedisHealth }; 