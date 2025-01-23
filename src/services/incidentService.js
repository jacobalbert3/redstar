const db = require('../config/db'); //using db module from config/db.js
const CacheService = require('./cacheService'); //TODO
const socketService = require('./socketService');

class IncidentService { //all methods relating to managing incidents
  static async createIncident(incidentData) {
    //static method: can be called on the class itself, not an instance of the class
    //extracts the incident data from the incidentData object
    const {
      latitude,
      longitude,
      type,
      description,
      severity
    } = incidentData;

    try {
      const result = await db.query(
        `INSERT INTO incidents (
          latitude, longitude, location, type, description, severity
        ) VALUES (
          $1, $2, 
          ST_SetSRID(ST_MakePoint($2, $1), 4326),
          $3, $4, $5
        )
        RETURNING *`,
        [latitude, longitude, type, description, severity]
      );

      const newIncident = result.rows[0];

      // Emit the new incident to all connected clients
      const io = socketService.getIO();
      io.emit('new-incident', {
        id: newIncident.id,
        latitude: newIncident.latitude,
        longitude: newIncident.longitude,
        type: newIncident.type,
        description: newIncident.description,
        severity: newIncident.severity,
        created_at: newIncident.created_at
      });

      return newIncident;
    } catch (error) {
      console.error('Error creating incident:', error);
      throw error;
    }
  }

  static async getNearbyIncidents(lat, lng, radius) {
    // radius is in meters
    let cacheKey = CacheService.generateLocationKey(lat, lng, radius);

    console.log("cacheKey: ", cacheKey);
    
    return CacheService.getOrSet(cacheKey, async () => {
      const result = await db.query(
        `SELECT 
          id, 
          latitude, 
          longitude, 
          type,
          description, 
          severity, 
          created_at,
          ST_Distance(
            location::geography, 
            ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
          ) as distance
        FROM incidents
        WHERE ST_DWithin(
          location::geography,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
          $3
        )
        ORDER BY severity DESC, created_at DESC`,
        [lat, lng, radius]
      );

      // Log the query results for debugging
      console.log(`Found ${result.rows.length} incidents within ${radius}m of ${lat}, ${lng}`);
      result.rows.forEach(incident => {
        console.log(`Incident ${incident.id}: ${incident.distance}m away`);
      });

      return result.rows;
    });
  }

  static async getAllIncidents() {
    try {
      const result = await db.query(
        `SELECT * FROM incidents ORDER BY created_at DESC`
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching all incidents:', error);
      throw error;
    }
  }

  static async refreshNearbyIncidents(lat, lng, radius) {
    console.log("refreshNearbyIncidents called");
    const cacheKey = CacheService.generateLocationKey(lat, lng, radius);
    await CacheService.delete(cacheKey);
    return true;
  }
}

module.exports = IncidentService; 