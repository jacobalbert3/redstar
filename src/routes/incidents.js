const express = require('express');
const router = express.Router();
const IncidentService = require('../services/incidentService');
const { authenticateToken } = require('../middleware/auth');

// Get all incidents
router.get('/', async (req, res) => {
  try {
    const incidents = await IncidentService.getAllIncidents();
    res.json(incidents);
  } catch (error) {
    console.error('Error fetching incidents:', error);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// Get nearby incidents
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius} = req.query; // radius in meters
    
    // Validate parameters
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const incidents = await IncidentService.getNearbyIncidents(
      //converts the lat and lng strings to floats
      parseFloat(lat),
      parseFloat(lng),
      parseFloat(radius)
    );
    //sends the incidents array as a JSON response to the client
    res.json(incidents);
  } catch (error) {
    console.error('Error fetching nearby incidents:', error);
    res.status(500).json({ error: 'Failed to fetch nearby incidents' });
  }
});


router.get('/refresh', async (req, res) => {
  const { lat, lng, radius} = req.query;
  const incidents = await IncidentService.refreshNearbyIncidents(lat, lng, radius);
  const new_incidents = await IncidentService.getNearbyIncidents(
    //converts the lat and lng strings to floats
    parseFloat(lat),
    parseFloat(lng),
    parseFloat(radius)
  );
  res.json(new_incidents);
});

// Create new incident
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Validate request body
    const { latitude, longitude, type, description, severity } = req.body;
    
    if (!latitude || !longitude || !type || !severity) {
      return res.status(400).json({ 
        error: 'Latitude, longitude, type, and severity are required' 
      });
    }

    // Validate severity range
    if (severity < 1 || severity > 5) {
      return res.status(400).json({ 
        error: 'Severity must be between 1 and 5' 
      });
    }

    const incident = await IncidentService.createIncident(req.body);
    res.status(201).json(incident);
  } catch (error) {
    console.error('Error creating incident:', error);
    res.status(500).json({ error: 'Failed to create incident' });
  }
});

module.exports = router; 