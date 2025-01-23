const express = require('express');
const router = express.Router();
const NewsService = require('../services/newsService');
const newsService = new NewsService();

router.get('/local', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    console.log('Received news request for:', { lat, lng });
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    const news = await newsService.getLocalNews(lat, lng);
    console.log(`Found ${news.length} news items`);
    res.json(news);
  } catch (error) {
    console.error('Error fetching local news:', error);
    res.status(500).json({ error: 'Failed to fetch local news' });
  }
});

module.exports = router; 