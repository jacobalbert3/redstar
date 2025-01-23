const { redis } = require('../config/redis');

class CacheService {
  // Default cache time of 30 minutes (in seconds)
  static DEFAULT_CACHE_TIME = 1800;
  
  // Maximum number of cached locations to keep
  static MAX_CACHED_LOCATIONS = 50;

  //async function to get a value from the cache
  static async get(key) {
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  //async function to set a value in the cache
  static async set(key, value, expirationInSeconds = this.DEFAULT_CACHE_TIME) {
    try {
      // sets a key value pair with an expiration date
      await redis.setex(key, expirationInSeconds, JSON.stringify(value));
      
      // tracks which keys are part of the cache
      await redis.sadd('cached_location_keys', key);
      
      // scard returns the number of elements in the set
      const totalCached = await redis.scard('cached_location_keys');
      if (totalCached > this.MAX_CACHED_LOCATIONS) {
        //spop removes and returns the last element of the set
        const oldestKey = await redis.spop('cached_location_keys');
        if (oldestKey) {
          //deletes the oldest key from the cache
          await redis.del(oldestKey);
        }
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  //generates a unique key for a location
  static generateLocationKey(lat, lng, radius) {
    // Round coordinates to 3 decimal places to create a reasonable cache grid
    const roundedLat = Math.round(lat * 100) / 100;
    const roundedLng = Math.round(lng * 100) / 100;
    return `location:${roundedLat}:${roundedLng}:${radius}`;
  }
//async function to get a value from the cache or set it if it doesn't exist
  static async getOrSet(key, fetchFunction, expirationInSeconds = this.DEFAULT_CACHE_TIME) {
    try {
      let value = await this.get(key);
      if (value) {
        console.log('Cache hit for key:', key);
        return value;
      }

      console.log('Cache miss for key:', key);
      const freshValue = await fetchFunction();
      await this.set(key, freshValue, expirationInSeconds);
      return freshValue;
    } catch (error) {
      console.error('Cache getOrSet error:', error);
      return fetchFunction();
    }
  }

  static async getCacheStats() {
    try {
      const totalKeys = await redis.scard('cached_location_keys');
      const keys = await redis.smembers('cached_location_keys');
      const stats = {
        totalLocations: totalKeys,
        cachedKeys: keys,
        memoryUsage: await redis.info('memory'),
      };
      return stats;
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return null;
    }
  }

  static async clearCache() {
    try {
      await redis.flushall();
      console.log('Cache cleared successfully');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  static async delete(key) {
    console.log("delete called");
    console.log("key: ", key);
    await redis.del(key);
    return true;
  }
}

module.exports = CacheService; 
module.exports = CacheService; 