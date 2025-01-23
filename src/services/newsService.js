const axios = require('axios');
const cheerio = require('cheerio');
//cheerio: a library for parsing HTML and XML

class NewsService {
  constructor() {
    this.cache = new Map();
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  }

  async getLocalNews(lat, lng) {
    try {
      //get the location name from the lat and lng
      const locationData = await this.getLocationName(lat, lng);
      const locationHierarchy = this.formatLocationString(locationData);
      
      const crimeKeywords = [
        'crime', 'shooting', 'emergeyncy', 'robbery', 'arrest', 'theft', 'assault',
        'murder', 'homicide', 'vandalism',  'burglary', 'police', 'incident',
      ];

      let allNews = [];
      
      // Try each location scope until we find some news
      for (const location of locationHierarchy) {
        console.log(`Searching news for location: ${location}`);
        
        const queries = crimeKeywords.map(keyword => 
          `(${keyword}) AND "${location}" when:7d`
        );

        const newsForLocation = await Promise.all(
          queries.map(async query => {
            try {
              const response = await axios.get(
                `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`,
                {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                  }
                }
              );

              const $ = cheerio.load(response.data, { xmlMode: true });
              const articles = [];

              $('item').each((i, item) => {
                const $item = $(item);
                const title = $item.find('title').text();
                const description = $item.find('description').text();
                
                console.log('Found article:', title); // Debug log
                
                // Initially collect all articles
                articles.push({
                  title,
                  link: $item.find('link').text(),
                  pubDate: new Date($item.find('pubDate').text()),
                  description,
                  relevanceScore: calculateRelevanceScore(title + ' ' + description)
                });
              });

              return articles;
            } catch (error) {
              console.error(`Error fetching news for query "${query}":`, error);
              return [];
            }
          })
        );
        //
        const flattenedNews = newsForLocation
          //flattens the array of arrays into a single array
          .flat()
          //filters out duplicate articles based on the title
          .filter((article, index, self) => 
            index === self.findIndex(a => a.title === article.title)
          );

        if (flattenedNews.length > 0) {
          allNews = flattenedNews;
          break; // Stop searching broader areas if we found news
        }
      }

      const recentNews = allNews
        .sort((a, b) => {
          const relevanceCompare = b.relevanceScore - a.relevanceScore;
          if (relevanceCompare !== 0) return relevanceCompare; // Higher relevance score first
          return a.pubDate - b.pubDate; // Earlier publication date first
        })
        .slice(0, 20);

      console.log(`Found ${recentNews.length} relevant news items`);
      return recentNews;

    } catch (error) {
      console.error('Error fetching local news:', error);
      return [];
    }
  }

  async getLocationName(lat, lng) {
    //axios: a promise based HTTP client for the browser and node.js
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        {
          headers: {
            'User-Agent': 'RedDot/1.0'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }

  formatLocationString(locationData) {
    if (!locationData?.address) return '';
    
    // Build location hierarchy from specific to broad
    const locationHierarchy = [];
    
    // Most specific: neighborhood/suburb + city
    if (locationData.address.neighbourhood && locationData.address.city) {
      locationHierarchy.push(`${locationData.address.neighbourhood} ${locationData.address.city}`);
    }
    
    // City/town level
    if (locationData.address.city) {
      locationHierarchy.push(locationData.address.city);
    } else if (locationData.address.town) {
      locationHierarchy.push(locationData.address.town);
    }
    
    // County level
    if (locationData.address.county) {
      locationHierarchy.push(locationData.address.county);
    }
    
    // Borough (for NYC)
    if (locationData.address.borough) {
      locationHierarchy.push(locationData.address.borough);
    }
    
    // State level
    if (locationData.address.state) {
      locationHierarchy.push(locationData.address.state);
    }
    
    return locationHierarchy;
  }
}

// Helper function to calculate relevance score
function calculateRelevanceScore(text) {
  let score = 0;
  const lowercaseText = text.toLowerCase();

  // Keywords and their weights for violent/serious crimes
  const keywords = {
    // Violent Crimes
    'murder': 10,
    'homicide': 10,
    'shooting': 9,
    'shot': 9,
    'assault': 8,
    'attack': 8,
    'stabbing': 8,
    'armed': 8,
    'violence': 7,
    'rape': 10,
    'kidnapping': 10,
    'abduction': 10,
    'arson': 8,
    'manslaughter': 9,
  
    // Property Crimes
    'robbery': 7,
    'burglary': 7,
    'theft': 6,
    'stolen': 6,
    'vandalism': 5,
    'looting': 5,
    'trespassing': 4,
    'fraud': 6,
    'embezzlement': 6,
  
    // Organized or White-Collar Crimes
    'gang': 6,
    'trafficking': 9,
    'smuggling': 8,
    'extortion': 8,
    'money laundering': 8,
    'bribery': 6,
    'cybercrime': 7,
  
    // Law Enforcement
    'police': 5,
    'arrest': 5,
    'suspect': 5,
    'warrant': 5,
    'fugitive': 7,
    'investigation': 4,
  
    // General Crime Terms
    'crime': 4,
    'criminal': 5,
    'illegal': 4,
    'charges': 5,
    'victim': 6,
    'evidence': 5
  };
  // Add points for keyword matches
  Object.entries(keywords).forEach(([keyword, weight]) => {
    if (lowercaseText.includes(keyword)) {
      score += weight;
    }
  });

  // Bonus points for multiple crime keywords
  const keywordCount = Object.keys(keywords)
    .filter(keyword => lowercaseText.includes(keyword)).length;
  score += keywordCount * 2;

  return score;
}

module.exports = NewsService; 