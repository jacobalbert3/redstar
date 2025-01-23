import React, { useState, useEffect } from "react";
import MapComponent from "./components/MapComponent";
import Home from "./components/Home";
import { jwtDecode } from 'jwt-decode';
import './App.css';
import { SocketProvider } from './context/SocketContext';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    //check token in local storage
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        //IF token is still valid, isAuthenticated is true
        if (decodedToken.exp * 1000 > Date.now()) {
          setIsAuthenticated(true);
          setUser(decodedToken);
        } else {
          localStorage.removeItem('token');
        }
      } catch (error) {
        console.error('Invalid token:', error);
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="loading">Initializing Security Protocol...</div>;
  }
//pass onLogin and onRegister functions to Home component
  if (!isAuthenticated) {
    return (
      <Home 
        onLogin={(token) => {
          localStorage.setItem('token', token);
          setIsAuthenticated(true);
          setUser(jwtDecode(token));
        }}
        onRegister={(token) => {
          localStorage.setItem('token', token);
          setIsAuthenticated(true);
          setUser(jwtDecode(token));
        }}
      />
    );
  }
//wrap the Mapcomonent in the socket provider. 
  return (
    <SocketProvider>
      <div className="App">
        <MapComponent />
      </div>
    </SocketProvider>
  );
}

export default App;