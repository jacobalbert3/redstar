import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

//create a context for the socket: 
//Context is a way to pass data through the component tree without having to pass props down manually at every level.
const SocketContext = createContext();

//custom hook to use the socket context: 
export function useSocket() { 
  return useContext(SocketContext);
}
//SocketProvider is a component that provides the socket context to the rest of the application.
export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [friendLocations, setFriendLocations] = useState({});
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [recentIncidents, setRecentIncidents] = useState([]);
  const watchIdRef = useRef(null);

  useEffect(() => {
    //setup the socket connection: 
    const setupSocket = async () => {
      const serverUrl = process.env.NODE_ENV === 'production' 
        ? process.env.REACT_APP_SERVER_URL 
        : 'http://localhost:9000';

      const newSocket = io(serverUrl, {
        auth: { token: localStorage.getItem('token') },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });
      //event listener for socket connection and friend location updates:
      newSocket.on('connect', () => {
        console.log('Socket connected!!');
        newSocket.emit('get-friend-locations');
      });

      newSocket.on('friend-location-update', (data) => {
        console.log('Received friend location update:', data);
        setFriendLocations(prev => ({
          ...prev,
          [data.userId]: {
            email: data.email,
            latitude: data.latitude,
            longitude: data.longitude,
            timestamp: data.timestamp,
            movement: data.movement
          }
        }));
      });

      newSocket.on('new-incident', (incident) => {
        console.log('New incident received:', incident);
        setRecentIncidents(prev => [incident, ...prev].slice(0, 10));
      });

      newSocket.on('friend-locations', (locations) => {
        console.log('Received initial friend locations:', locations);
        setFriendLocations(locations);
      });

      setSocket(newSocket);

      // Check initial location state
      try {
        const response = await fetch('/api/profile/location-state', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await response.json();
        setIsLocationEnabled(data.is_location_enabled);
        if (data.is_location_enabled) {
          startLocationTracking(newSocket);
        }
      } catch (error) {
        console.error('Error fetching location state:', error);
      }
    };

    setupSocket();

    return () => {
      stopLocationTracking();
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const startLocationTracking = (socketToUse = socket) => {
    console.log('Starting location tracking');
    if (!socketToUse) return;
  
    // To store the most recent location
    let lastLocation = null;
  
    // Start geolocation watcher
    watchIdRef.current = navigator.geolocation.watchPosition(
      //how it works: success callback function that gets called with the position object.
      //position object contains the latitude, longitude, and timestamp of the user's current location.
      (position) => {
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date().toISOString(),
        };
  
        lastLocation = newLocation; // Save the latest location
        setUserLocation(newLocation);
        console.log('Emitting location movement:', newLocation);
        socketToUse.emit('update-location', newLocation);
      },
      (error) => console.error('Geolocation error:', error),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 300000,
      }
    );
  
    // Force an update every 15 seconds
    const intervalId = setInterval(() => {
      if (!lastLocation) return; // Skip if no location has been captured yet
      console.log('Emitting forced location update:', lastLocation);
      socketToUse.emit('update-location', lastLocation);
    }, 15000);
  
    // Return a cleanup function to stop tracking
    return () => {
      console.log('Stopping location tracking');
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      clearInterval(intervalId);
    };
  };
  

  const stopLocationTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setUserLocation(null);
    }
  };

  const toggleLocationTracking = async (enabled) => {
    try {
      const response = await fetch('/api/profile/location-toggle', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled })
      });

      if (response.ok) {
        setIsLocationEnabled(enabled);
        if (enabled) {
          startLocationTracking();
        } else {
          stopLocationTracking();
        }
      }
    } catch (error) {
      console.error('Error toggling location:', error);
    }
  };

  const value = {
    socket,
    friendLocations,
    isLocationEnabled,
    userLocation,
    recentIncidents,
    toggleLocationTracking
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
} 
//Socket Provider is a component that provides the socket context to the rest of the application.
//children reporesents any components that are wrapped by the SocketProvider.