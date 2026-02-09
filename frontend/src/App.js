import React, { useState, useEffect } from 'react';
import './App.css';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import { getUser, getToken, clearAuth, setOnUnauthorized } from './utils/auth';

function App() {
  const [user, setUser] = useState(null);

  // Check localStorage for existing session on mount
  useEffect(() => {
    const savedUser = getUser();
    const savedToken = getToken();
    if (savedUser && savedToken) {
      setUser(savedUser);
    } else {
      // If either is missing, clear both
      clearAuth();
    }
  }, []);

  // Register the global 401 handler so any authFetch 401 triggers logout
  useEffect(() => {
    setOnUnauthorized(() => {
      setUser(null);
    });
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
    clearAuth();
  };

  // Show login page if not authenticated
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <div className="main-content">
        <Header user={user} onLogout={handleLogout} />
        <Dashboard />
      </div>
    </div>
  );
}

export default App;
