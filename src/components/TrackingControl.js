import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';

function TrackingControl() {
  const { 
    isLocationEnabled, 
    toggleLocationTracking, 
    friendLocations,
    recentIncidents,
    userLocation
  } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [lastProcessedUpdates, setLastProcessedUpdates] = useState({});
  const [lastProcessedIncidents, setLastProcessedIncidents] = useState({});

  // Watch for both friend locations and incident updates
  useEffect(() => {
    console.log('Friend locations updated:', friendLocations); // Debug log

    const addNotification = (type, message) => {
      const notification = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        message,
        timestamp: new Date()
      };
      setNotifications(prev => [notification, ...prev].slice(0, 5));
    };

    // Check for friend location updates
    Object.entries(friendLocations || {}).forEach(([userId, location]) => {
      if (!location?.timestamp) return;

      const locationTime = new Date(location.timestamp);
      const lastProcessed = lastProcessedUpdates[userId] || 0;
      const lastProcessedTime = new Date(lastProcessed);

      // Compare timestamps to detect new updates
      if (locationTime > lastProcessedTime) {
        console.log('New location detected for:', location.email, 'at:', locationTime);
        
        addNotification(
          'friend', 
          `${location.email.split('@')[0]} moved to new location`
        );

        // Update the last processed time for this friend
        setLastProcessedUpdates(prev => ({
          ...prev,
          [userId]: locationTime.toISOString()
        }));
      }
    });

    // Check for new incidents
    recentIncidents.forEach(incident => {
      if (!incident?.id) return;
      
      const incidentTime = new Date(incident.timestamp || incident.created_at);
      const lastProcessed = lastProcessedIncidents[incident.id] || 0;
      const lastProcessedTime = new Date(lastProcessed);

      if (incidentTime > lastProcessedTime) {
        console.log('New incident detected:', incident);
        
        addNotification(
          'incident',
          `New ${incident.type} incident reported (Severity: ${incident.severity})`
        );

        // Update the last processed time for this incident
        setLastProcessedIncidents(prev => ({
          ...prev,
          [incident.id]: incidentTime.toISOString()
        }));
      }
    });
  }, [friendLocations, recentIncidents]);

  return (
    <div className="tracking-control-panel">
      <div className="tracking-header">
        <div className="tracking-title">
          <h3>LOCATION TRACKING</h3>
          <div className="tracking-status">
            <div className={`status-indicator ${isLocationEnabled ? 'active' : ''}`}>
              <div className="pulse-ring"></div>
            </div>
            <span>{isLocationEnabled ? 'TRANSMITTING' : 'OFFLINE'}</span>
          </div>
        </div>
        <button 
          onClick={() => toggleLocationTracking(!isLocationEnabled)}
          className={`control-button ${isLocationEnabled ? 'active' : ''}`}
        >
          {isLocationEnabled ? 'STOP TRANSMISSION' : 'START TRANSMISSION'}
        </button>
      </div>

      <div className="notifications-container">
        <div className="notifications-header">
          <h4>LIVE FEED</h4>
          <span className="notification-count">{notifications.length}</span>
        </div>
        <div className="notifications-list">
          {notifications.length > 0 ? (
            notifications.map(notification => (
              <div 
                key={notification.id} 
                className={`notification-item ${notification.type}`}
              >
                <div className="notification-icon">
                  {notification.type === 'friend' ? '📍' : '⚠️'}
                </div>
                <div className="notification-content">
                  <p className="notification-message">{notification.message}</p>
                  <span className="notification-time">
                    {new Date(notification.timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="no-notifications">No recent updates</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default TrackingControl; 