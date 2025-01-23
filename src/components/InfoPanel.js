import React, { useState, useEffect } from 'react';
import './InfoPanel.css';

function InfoPanel({ location, incidents = [], onClose, searchRadius, onRefresh }) {
  const [activeTab, setActiveTab] = useState('incidents');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reportForm, setReportForm] = useState({
    type: '',
    description: '',
    severity: '1'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [newsArticles, setNewsArticles] = useState([]);
  const [isLoadingNews, setIsLoadingNews] = useState(false);

  if (!location || !location.lat || !location.lng) {
    return null;
  }

  
  const handleRefresh = async () => {
    if (!location || !location.lat || !location.lng) {
      console.error("Location is undefined or invalid");
      return;
    }
  
    console.log("handleRefresh called");
    setIsRefreshing(true);
    try {
      await onRefresh(); // Call parent's refresh handler
    } catch (error) {
      console.error("Error refreshing incidents:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!isLoggedIn) {
      setError('Please log in to report incidents');
      setIsSubmitting(false);
      return;
    }
    
    const newIncident = {
      latitude: location.lat,
      longitude: location.lng,
      type: reportForm.type,
      description: reportForm.description,
      severity: parseInt(reportForm.severity)
    };

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newIncident)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create incident');
      }

      const data = await response.json();
      console.log('Incident created:', data);

      // Reset form
      setReportForm({
        type: '',
        description: '',
        severity: '1'
      });

      // Switch back to incidents tab
      setActiveTab('incidents');


    } catch (error) {
      console.error('Error creating incident:', error);
      setError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sort incidents by severity (highest to lowest) with null check
  const sortedIncidents = (incidents || []).sort((a, b) => b.severity - a.severity);

  // Check if user is logged in
  const isLoggedIn = !!localStorage.getItem('token');

  // Fetch nearby chats when location or tab changes
  useEffect(() => {
    if (activeTab === 'chat' && location) {
      fetchNearbyChats();
    }
  }, [location, activeTab]);

  // Fetch chat comments when a chat is selected
  useEffect(() => {
    if (selectedChat) {
      fetchChatComments(selectedChat.id);
    }
  }, [selectedChat]);

  const fetchNearbyChats = async () => {
    setIsLoadingChats(true);
    try {
      const response = await fetch(
        `/api/chats/nearby?lat=${location.lat}&lng=${location.lng}&radius=${searchRadius}`
      );
      if (!response.ok) throw new Error('Failed to fetch chats');
      const data = await response.json();
      setChats(data);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setIsLoadingChats(false);
    }
  };

  const fetchChatComments = async (chatId) => {
    try {
      const response = await fetch(`/api/chats/${chatId}/comments`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      const data = await response.json();
      setComments(data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleCreateChat = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: `Chat at ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`,
          latitude: location.lat,
          longitude: location.lng
        })
      });

      if (!response.ok) throw new Error('Failed to create chat');
      const newChat = await response.json();
      setChats(prev => [...prev, newChat]);
      setSelectedChat(newChat);
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!selectedChat || !newComment.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/chats/${selectedChat.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: newComment })
      });

      if (!response.ok) throw new Error('Failed to post comment');
      const comment = await response.json();
      setComments(prev => [...prev, comment]);
      setNewComment('');
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

  // Add this effect to fetch news when location or tab changes
  useEffect(() => {
    if (activeTab === 'history' && location) {
      fetchLocalNews();
    }
  }, [location, activeTab]);

  const fetchLocalNews = async () => {
    if (!location) return;
    
    console.log('Fetching news for location:', location); // Debug log
    setIsLoadingNews(true);
    try {
      const response = await fetch(
        `/api/news/local?lat=${location.lat}&lng=${location.lng}`
      );
      
      if (!response.ok) {
        console.error('News response not ok:', response.status); // Debug log
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received news data:', data); // Debug log
      setNewsArticles(data);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setIsLoadingNews(false);
    }
  };

  return (
    <div className="info-panel" data-cy="info-panel">
      <button className="close-button" onClick={onClose} data-cy="close-button">×</button>
      
      <div className="location-header">
        <h3>Selected Location</h3>
        <p>
          Lat: {Number(location.lat).toFixed(4)}, 
          Lng: {Number(location.lng).toFixed(4)}
        </p>
      </div>

      <div className="tabs">
        <button 
          className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          Chat
        </button>
        <button 
          className={`tab-button ${activeTab === 'incidents' ? 'active' : ''}`}
          onClick={() => setActiveTab('incidents')}
          data-cy="incidents-tab"
        >
          Incidents
        </button>
        <button 
          className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
        <button 
          className={`tab-button ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
          data-cy="report-tab"
        >
          Report
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'chat' && (
          <div className="chat-section">
            {!selectedChat ? (
              <div className="chats-list">
                <div className="chats-header">
                  <h4>Nearby Chats</h4>
                  <button 
                    className="create-chat-button"
                    onClick={handleCreateChat}
                    disabled={!isLoggedIn}
                  >
                    Create Chat
                  </button>
                </div>
                {isLoadingChats ? (
                  <p className="loading-text">Loading chats...</p>
                ) : chats.length === 0 ? (
                  <p className="no-chats">No chats in this area</p>
                ) : (
                  chats.map(chat => (
                    <div 
                      key={chat.id} 
                      className="chat-item"
                      onClick={() => {
                        setSelectedChat(chat);
                        fetchChatComments(chat.id);
                      }}
                    >
                      <h4>{chat.title}</h4>
                      <p className="chat-time">
                        Created {new Date(chat.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="chat-detail">
                <div className="chat-header">
                  <button 
                    className="back-button"
                    onClick={() => setSelectedChat(null)}
                  >
                    ←
                  </button>
                  <h4>{selectedChat.title}</h4>
                </div>
                <div className="chat-messages">
                  {comments.map(comment => (
                    <div key={comment.id} className="comment">
                      <div className="comment-header">
                        <span className="comment-author">{comment.author}</span>
                        <span className="comment-time">
                          {new Date(comment.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="comment-content">{comment.content}</p>
                    </div>
                  ))}
                </div>
                {isLoggedIn ? (
                  <form onSubmit={handleSubmitComment} className="comment-form">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Type a message..."
                    />
                    <button type="submit">Send</button>
                  </form>
                ) : (
                  <div className="login-prompt">
                    <p>Please log in to participate in chats</p>
                    <button 
                      onClick={() => window.location.href = '/login'}
                      className="login-button"
                    >
                      Log In
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'incidents' && (
          <div className="incidents-section">
            <div className="incidents-header">
              <h4>Nearby Incidents ({sortedIncidents.length})</h4>
              <button 
                className={`refresh-button ${isRefreshing ? 'refreshing' : ''}`}
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                ↻
              </button>
            </div>
            <div className="incidents-list" data-cy="incident-list">
              {sortedIncidents.map(incident => (
                <div key={incident.id} className="incident-item">
                  <div className={`severity-indicator severity-${incident.severity}`}>
                    {incident.severity}
                  </div>
                  <div className="incident-details">
                    <h4>{incident.type}</h4>
                    {incident.description && (
                      <p className="description">{incident.description}</p>
                    )}
                    <p className="incident-time">
                      {new Date(incident.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {sortedIncidents.length === 0 && (
                <p className="no-incidents">No incidents reported in this area</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-section">
            <div className="history-header">
              <h4>Recent Incidents</h4>
              <p className="subtitle">Within 1km of selected location</p>
            </div>
            
            {isLoadingNews ? (
              <div className="loading-news">Loading incidents...</div>
            ) : newsArticles.length === 0 ? (
              <div className="no-news">
                <p>No recent incidents found in this area</p>
                <p className="location-context">
                  Location: {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Unknown'}
                </p>
              </div>
            ) : (
              <ul className="incident-list">
                {newsArticles.map((article, index) => (
                  <li key={index} className="incident-item">
                    <a 
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {article.title}
                    </a>
                    <span className="incident-date">
                      {new Date(article.pubDate).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'report' && (
          <div className="report-section">
            {!isLoggedIn ? (
              <div className="login-prompt">
                <p>Please log in to report incidents</p>
                <button 
                  className="login-button"
                  onClick={() => {
                    // Redirect to login page or show login modal
                    window.location.href = '/login';
                  }}
                >
                  Log In
                </button>
              </div>
            ) : (
              <>
                {error && (
                  <div className="error-message">
                    {error}
                  </div>
                )}
                <form onSubmit={handleReportSubmit} className="report-form">
                  <select 
                    value={reportForm.type}
                    onChange={(e) => setReportForm({...reportForm, type: e.target.value})}
                    required
                    data-cy="incident-type"
                  >
                    <option value="">Select Type</option>
                    <option value="theft">Theft</option>
                    <option value="assault">Assault</option>
                    <option value="vandalism">Vandalism</option>
                    <option value="suspicious_activity">Suspicious Activity</option>
                  </select>

                  <select 
                    value={reportForm.severity}
                    onChange={(e) => setReportForm({...reportForm, severity: e.target.value})}
                    required
                    data-cy="incident-severity"
                  >
                    <option value="1">1 - Minor</option>
                    <option value="2">2 - Moderate</option>
                    <option value="3">3 - Serious</option>
                    <option value="4">4 - Severe</option>
                    <option value="5">5 - Critical</option>
                  </select>

                  <textarea
                    value={reportForm.description}
                    onChange={(e) => setReportForm({...reportForm, description: e.target.value})}
                    placeholder="Description"
                    required
                    data-cy="incident-description"
                  />

                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    data-cy="submit-incident"
                  >
                    {isSubmitting ? 'Submitting...' : 'Report Incident'}
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default InfoPanel; 