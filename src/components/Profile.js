import React, { useState, useEffect, useRef } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import './Profile.css';
import { useSocket } from '../context/SocketContext';

function Profile({ map: mapRef }) {
  // States for UI
  const [activeTab, setActiveTab] = useState('tracker');
  const [message, setMessage] = useState('');
  const [userEmail, setUserEmail] = useState(null);
  const [friends, setFriends] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [newFriendEmail, setNewFriendEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Get everything location/socket related from context
  const { 
    friendLocations, 
    userLocation
  } = useSocket();

  // Add new state for friends' location states
  const [friendLocationStates, setFriendLocationStates] = useState({});

  // Load user data on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserEmail(payload.email);
        Promise.all([
          fetchFriends(),
          fetchRequests()
        ]).catch(error => {
          console.error('Error fetching data:', error);
        });
      } catch (error) {
        console.error('Error decoding token:', error);
      }
    }
  }, []);

  // Fetch friends list
  const fetchFriends = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/profile/friends', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      // Create a map of friend IDs to their location states
      const locationStates = {};
      data.forEach(friend => {
        locationStates[friend.id] = {
          is_location_enabled: friend.is_location_enabled,
          last_location: friend.longitude && friend.latitude ? {
            longitude: friend.longitude,
            latitude: friend.latitude
          } : null,
          last_location_timestamp: friend.last_location_timestamp
        };
      });
      
      setFriendLocationStates(locationStates);
      setFriends(data);
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  // Fetch friend requests
  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/profile/requests', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setReceivedRequests(data.received);
      setSentRequests(data.sent);
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  // Send friend request
  const sendFriendRequest = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/profile/send-request', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: newFriendEmail })
      });
      
      if (response.ok) {
        setMessage('Friend request sent!');
        setNewFriendEmail('');
        fetchRequests();
      } else {
        const error = await response.json();
        setMessage(error.message);
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      setMessage('Error sending request');
    }
  };

  // Handle friend request response
  const handleRequestResponse = async (requestId, action) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/profile/respond-request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requestId, action })
      });

      if (response.ok) {
        fetchRequests();
        if (action === 'accept') {
          fetchFriends();
        }
      }
    } catch (error) {
      console.error('Error responding to request:', error);
    }
  };

  // Handle zoom to user
  const handleZoomToMe = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 15
      });
    }
  };

  // Add useEffect to update friend location states when friendLocations changes
  useEffect(() => {
    if (!friendLocations) return;

    setFriendLocationStates(prevStates => {
      const newStates = { ...prevStates };
      Object.entries(friendLocations).forEach(([userId, location]) => {
        if (newStates[userId]) {
          newStates[userId] = {
            ...newStates[userId],
            last_location: {
              latitude: location.latitude,
              longitude: location.longitude
            },
            last_location_timestamp: location.timestamp
          };
        }
      });
      return newStates;
    });
  }, [friendLocations]);

  // Update handleZoomToFriend to properly handle location data
  const handleZoomToFriend = (friend) => {
    if (!mapRef.current) {
      console.log('Map reference not available');
      return;
    }
    
    // Try to use real-time location first
    const realtimeLocation = friendLocations[friend.id];
    // Fall back to stored location from friend location states
    const storedLocation = friendLocationStates[friend.id]?.last_location;
    
    console.log('Friend ID:', friend.id);
    console.log('Realtime location:', realtimeLocation);
    console.log('Stored location:', storedLocation);
    
    let locationToUse = null;
    
    if (realtimeLocation && realtimeLocation.latitude && realtimeLocation.longitude) {
      locationToUse = realtimeLocation;
    } else if (storedLocation && storedLocation.latitude && storedLocation.longitude) {
      locationToUse = storedLocation;
    }
    
    if (locationToUse) {
      console.log('Flying to location:', locationToUse);
      mapRef.current.flyTo({
        center: [locationToUse.longitude, locationToUse.latitude],
        zoom: 15,
        essential: true
      });
    } else {
      console.log('No valid location found for friend');
    }
  };

  return (
    <div className="profile-container">
      <h2>My Profile</h2>
      <div className="user-info">
        <p>User Email: {userEmail || 'No user logged in'}</p>
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'tracker' ? 'active' : ''}`}
          onClick={() => setActiveTab('tracker')}
        >
          Location Tracker
        </button>
        <button 
          className={`tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Requests
        </button>
      </div>

      {activeTab === 'tracker' && (
        <div className="tracker-tab">
          {userLocation && (
            <button className="zoom-to-me-button" onClick={handleZoomToMe}>
              Zoom to Me
            </button>
          )}

          <div className="friends-list">
            <h3>Friends</h3>
            {isLoading ? (
              <p>Loading friend locations...</p>
            ) : (
              friends.map(friend => (
                <div key={friend.id} className="friend-item">
                  <div className="friend-info">
                    <div className="friend-header">
                      <span className="friend-email">{friend.email}</span>
                      {friendLocationStates[friend.id]?.is_location_enabled && (
                        <button 
                          className="zoom-to-friend-btn"
                          onClick={() => handleZoomToFriend(friend)}
                          title="Zoom to friend's location"
                        >
                          Zoom
                        </button>
                      )}
                    </div>
                    <div className="friend-location-status">
                      {friendLocationStates[friend.id]?.is_location_enabled ? (
                        <>
                          <span className="location-shared">Location shared</span>
                          {friendLocationStates[friend.id]?.last_location_timestamp && (
                            <span className="location-timestamp">
                              Last updated: {new Date(friendLocationStates[friend.id].last_location_timestamp).toLocaleString()}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="location-not-shared">Location not shared</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="requests-tab">
          <div className="send-request">
            <h3>Send Friend Request</h3>
            <input
              type="email"
              value={newFriendEmail}
              onChange={(e) => setNewFriendEmail(e.target.value)}
              placeholder="Enter friend's email"
            />
            <button onClick={sendFriendRequest}>Send Request</button>
          </div>

          <div className="received-requests">
            <h3>Received Requests</h3>
            {receivedRequests.length === 0 ? (
              <p>No pending requests</p>
            ) : (
              receivedRequests.map(request => (
                <div key={request.id} className="request-item">
                  <span>{request.sender_email}</span>
                  <div className="request-actions">
                    <button onClick={() => handleRequestResponse(request.id, 'accept')}>
                      Accept
                    </button>
                    <button onClick={() => handleRequestResponse(request.id, 'reject')}>
                      Deny
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="sent-requests">
            <h3>Sent Requests</h3>
            {sentRequests.length === 0 ? (
              <p>No pending requests</p>
            ) : (
              sentRequests.map(request => (
                <div key={request.id} className="request-item">
                  <span>{request.receiver_email}</span>
                  <span className="status">Pending</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {message && (
        <div className="status-message">
          {message}
        </div>
      )}
    </div>
  );
}

export default Profile; 