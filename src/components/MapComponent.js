import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import './MapComponent.css';
import InfoPanel from './InfoPanel';
import TrackingControl from './TrackingControl';
import SearchBar from './SearchBar';
import './Profile.css';
import Profile from './Profile';
import { useSocket } from '../context/SocketContext';

function MapComponent() {
  //mapContainer: ref to the DOM element where the map will be rendered
  //map: ref to the map instance
  const mapContainer = useRef(null);
  const map = useRef(null);
  const userMarkerRef = useRef(null);
  const friendMarkersRef = useRef({});
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const searchRadius = 3000; // 3km radius in meters
  const circleLayer = 'search-radius-layer';
  const circleSource = 'search-radius-source';
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);

  // Get socket context data
  const { 
    friendLocations, 
    userLocation,
    userEmail
  } = useSocket();

  // Add state for token
  const [mapboxToken, setMapboxToken] = useState(null);

  useEffect(() => {
    // Function to get Mapbox token
    const getMapboxToken = () => {
      const token = process.env.REACT_APP_MAPBOX_API_KEY;
      if (!token) {
        console.error('Mapbox token not found in environment variables');
        return null;
      }
      return token;
    };

    // Initialize map only after we have the token
    const token = getMapboxToken();
    console.log('Mapbox token available:', !!token); // Debug log
    
    if (token && !map.current) {
      try {
        // Set the token globally for Mapbox GL
        mapboxgl.accessToken = token;
        
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [-74.0060, 40.7128],
          zoom: 12
        });

        // Add click handler after map loads
        map.current.on('load', () => {
          console.log('Map loaded successfully'); // Debug log
          window.mapLoaded = true;
          
          // Add click event listener here
          map.current.on('click', handleMapClick);
        });

      } catch (error) {
        console.error('Map initialization error:', error);
      }
    }

    return () => {
      if (map.current) {
        // Remove click handler before removing map
        map.current.off('click', handleMapClick);
        map.current.remove();
      }
    };
  }, []);

  // Handle user location updates
  useEffect(() => {
    if (!map.current || !userLocation) {
      console.log('Missing requirements for user marker:', {
        hasMap: !!map.current,
        userLocation
      });
      return;
    }

    console.log('Updating user location:', userLocation);

    // Create or update user marker
    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'user-marker';
      //creates a new mapboxgl.Marker instance with the marker element as its content
      userMarkerRef.current = new mapboxgl.Marker({
        element: el,
      })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
              <div class="user-popup">
                <h3>You</h3>
                <p>Last updated: ${new Date().toLocaleString()}</p>
              </div>
            `)
        )
        .addTo(map.current);
    } else {
      // Update existing marker position and popup
      userMarkerRef.current
      //.setLngLat, .getPopup, .setHTML: methods of the Marker class
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .getPopup()
        .setHTML(`
          <div class="user-popup">
            <h3>You</h3>
            <p>Last updated: ${new Date().toLocaleString()}</p>
          </div>
        `);
    }
  }, [userLocation, map.current]);

  // Handle friend location updates
  useEffect(() => {
    if (!map.current || !friendLocations) return;

    console.log('Friend locations update:', friendLocations);

    // Update existing markers and create new ones
    Object.entries(friendLocations).forEach(([userId, location]) => {
      if (!location || !location.latitude || !location.longitude) return;

      if (friendMarkersRef.current[userId]) {
        // Update existing marker
        friendMarkersRef.current[userId].setLngLat([location.longitude, location.latitude]);
      } else {
        // Create new marker
        const marker = new mapboxgl.Marker({ color: '#4CAF50' })
          .setLngLat([location.longitude, location.latitude])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 })
              .setHTML(`
                <div class="friend-popup">
                  <h3>${location.email.split('@')[0]}</h3>
                  <p>Last updated: ${new Date(location.timestamp).toLocaleString()}</p>
                </div>
              `)
          )
          .addTo(map.current);

        friendMarkersRef.current[userId] = marker;
      }
    });

    // Remove markers for friends that are no longer in the friendLocations
    Object.keys(friendMarkersRef.current).forEach(userId => {
      if (!friendLocations[userId]) {
        friendMarkersRef.current[userId].remove();
        delete friendMarkersRef.current[userId];
      }
    });
  }, [friendLocations]);

  // Cleanup markers when component unmounts
  useEffect(() => {
    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
      }
      Object.values(friendMarkersRef.current).forEach(marker => {
        marker.remove();
      });
      friendMarkersRef.current = {};
    };
  }, []);

  const handleMapClick = async (e) => {
    console.log('Map clicked at:', e.lngLat); // Add this for debugging
    
    const { lng, lat } = e.lngLat;
    setSelectedLocation({ 
      lat: lat,
      lng: lng
    });

    // Update or add the circle
    updateSearchCircle(lng, lat);

    // Fetch nearby incidents
    try {
      console.log(`Searching for incidents within ${searchRadius}m of ${lat}, ${lng}`);
      const response = await fetch(
        `/api/incidents/nearby?lat=${lat}&lng=${lng}&radius=${searchRadius}`
      );
      const data = await response.json();
      console.log(`Found ${data.length} incidents`);
      setIncidents(data);
      updateIncidentMarkers(data);
    } catch (error) {
      console.error('Error fetching incidents:', error);
    }
  };

  const updateSearchCircle = (lng, lat) => {
    if (!map.current) return;

    // Remove existing circle if it exists
    if (map.current.getSource(circleSource)) {
      map.current.removeLayer(circleLayer);
      map.current.removeSource(circleSource);
    }

    // Add new circle
    map.current.addSource(circleSource, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        properties: {}
      }
    });

    map.current.addLayer({
      id: circleLayer,
      type: 'circle',
      source: circleSource,
      paint: {
        'circle-radius': {
          stops: [
            [0, 0],
            [10, searchRadius / 100], // City level view
            [15, searchRadius / 30],  // Street level view
          ]
        },
        'circle-color': '#ff0000',
        'circle-opacity': 0.2,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ff0000'
      }
    });
  };

  const updateIncidentMarkers = (incidents) => {
    // Remove existing markers if they exist
    const existingMarkers = document.getElementsByClassName('incident-marker');
    while (existingMarkers[0]) {
      existingMarkers[0].remove();
    }

    // Add new markers
    incidents.forEach(incident => {
      const marker = document.createElement('div');
      marker.className = 'incident-marker';
      marker.style.backgroundColor = getSeverityColor(incident.severity);

      new mapboxgl.Marker(marker)
        .setLngLat([incident.longitude, incident.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
              <div class="incident-popup">
                <h3>${incident.type}</h3>
                <p class="incident-severity">Severity: ${incident.severity}</p>
                <p>${incident.description || 'No description available'}</p>
                <p>Posted: ${new Date(incident.created_at).toLocaleString()}</p>
              </div>
            `)
        )
        .addTo(map.current);
    });
  };

  const getSeverityColor = (severity) => {
    const colors = {
      1: '#ffeb3b', // Yellow
      2: '#ff9800', // Orange
      3: '#ff5722', // Deep Orange
      4: '#f44336', // Red
      5: '#b71c1c'  // Dark Red
    };
    return colors[severity] || '#gray';
  };
  const handleSearch = async (searchQuery) => {
    try {
      // If searchQuery is an object with coordinates, use them directly
      if (typeof searchQuery === 'object' && searchQuery.center) {
        const [lng, lat] = searchQuery.center;
        
        // Fly to the location
        map.current.flyTo({
          center: [lng, lat],
          zoom: 14,
          essential: true
        });
        // Update location state
        setSelectedLocation({ 
          lat: lat,
          lng: lng
        });
        // Update circle and fetch incidents
        updateSearchCircle(lng, lat);

        const incidentsResponse = await fetch(
          `/api/incidents/nearby?lat=${lat}&lng=${lng}&radius=${searchRadius}`
        );
        const incidentsData = await incidentsResponse.json();
        setIncidents(incidentsData);
        updateIncidentMarkers(incidentsData);
        return;
      }

      // Otherwise, perform geocoding as before
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${mapboxgl.accessToken}`
      );
      
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        
        // Fly to the location
        map.current.flyTo({
          center: [lng, lat],
          zoom: 14,
          essential: true
        });

        setSelectedLocation({ 
          lat: lat,
          lng: lng
        });

        updateSearchCircle(lng, lat);

        const incidentsResponse = await fetch(
          `/api/incidents/nearby?lat=${lat}&lng=${lng}&radius=${searchRadius}`
        );
        const incidentsData = await incidentsResponse.json();
        setIncidents(incidentsData);
        updateIncidentMarkers(incidentsData);
      }
    } catch (error) {
      console.error('Error during search:', error);
    }
  };

  const handleRefresh = async () => {
    if (selectedLocation) {
      try {
        // First clear the cache
        await fetch(
          `/api/incidents/refresh?lat=${selectedLocation.lat}&lng=${selectedLocation.lng}&radius=${searchRadius}`
        );
        // Then get fresh incidents
        const response = await fetch(
          `/api/incidents/nearby?lat=${selectedLocation.lat}&lng=${selectedLocation.lng}&radius=${searchRadius}`
        );
        const data = await response.json();
        setIncidents(data);
        updateIncidentMarkers(data);
      } catch (error) {
        console.error('Error refreshing incidents:', error);
      }
    }
  };

  return (
    <div className="map-wrapper">
      <div className="top-bar">
        <h1 className="title">RedStar</h1>
        <div className="profile-controls">
          <button 
            className={`control-button ${isTrackingOpen ? 'active' : ''}`}
            onClick={() => setIsTrackingOpen(!isTrackingOpen)}
          >
            {isTrackingOpen ? 'CLOSE TRACKING' : 'TRACKING'}
          </button>
          <button 
            className="control-button"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
          >
            {isProfileOpen ? 'CLOSE PROFILE' : 'PROFILE'}
          </button>
          <button 
            className="control-button"
            onClick={() => {
              localStorage.removeItem('token');
              window.location.href = '/login';
            }}
          >
            LOGOUT
          </button>
        </div>
      </div>

      {isTrackingOpen && (
        <div className="tracking-dropdown">
          <TrackingControl />
        </div>
      )}

      <SearchBar onSearch={handleSearch} />

      {isProfileOpen && (
        <Profile map={map} />
      )}

      <div 
        ref={mapContainer} 
        className="map-container" 
        data-cy="map-container"
        style={{ height: '100vh' }}
      />
      {selectedLocation && (
        <InfoPanel 
          data-cy="info-panel"
          location={selectedLocation}
          incidents={incidents}
          onClose={() => setSelectedLocation(null)}
          searchRadius={searchRadius}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
}

export default MapComponent;