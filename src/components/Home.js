import React, { useState, useRef } from 'react';
import './Home.css';

function Home({ onLogin, onRegister }) {
  //onLogin and onRegister are callback functions passed down from App.js
  const [activeForm, setActiveForm] = useState('login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const containerRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const { clientX, clientY } = e;
    const { width, height, left, top } = containerRef.current.getBoundingClientRect();
    const x = (clientX - left) / width;
    const y = (clientY - top) / height;
    
    containerRef.current.style.setProperty('--mouse-x', x);
    containerRef.current.style.setProperty('--mouse-y', y);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    //receives both login and register requests
    try {
      const endpoint = activeForm === 'login' ? '/api/login' : '/api/register';
      
      if (activeForm === 'register' && formData.password !== formData.confirmPassword) {
        setError('Access codes do not match');
        return;
      }
      //post either login or register request to the server
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Authentication failed');
      }

      const { token } = await response.json();
      //if login, call onLogin with token
      //if register, call onRegister with token
      activeForm === 'login' ? onLogin(token) : onRegister(token);
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="security-container" ref={containerRef} onMouseMove={handleMouseMove}>
      <div className="security-background">
        <div className="grid"></div>
        <div className="scan-line"></div>
      </div>

      <div className="security-content">
        <div className="security-header">
          <h1>RED STAR</h1>
          <div className="security-subtitle">ADVANCED SECURITY PROTOCOL</div>
        </div>

        <form onSubmit={handleSubmit} className="security-form" data-cy="auth-form">
          <div className="form-tabs">
            <button 
              type="button"
              className={activeForm === 'login' ? 'active' : ''}
              onClick={() => setActiveForm('login')}
              data-cy="login-tab"
            >
              LOGIN
            </button>
            <button 
              type="button"
              className={activeForm === 'register' ? 'active' : ''}
              onClick={() => setActiveForm('register')}
              data-cy="register-tab"
            >
              REGISTER
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
              data-cy="email-input"
            />
            <label>USER EMAIL</label>
          </div>

          <div className="form-group">
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
              data-cy="password-input"
            />
            <label>ACCESS CODE</label>
          </div>

          {activeForm === 'register' && (
            <div className="form-group">
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                required
                data-cy="confirm-password-input"
              />
              <label>VERIFY ACCESS CODE</label>
            </div>
          )}

          <button type="submit" className="submit-button" data-cy="submit-button">
            {activeForm === 'login' ? 'INITIALIZE ACCESS' : 'REQUEST CLEARANCE'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Home; 