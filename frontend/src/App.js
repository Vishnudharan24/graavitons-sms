import React, { useState, useEffect } from 'react';
import './App.css';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import { clearAuthStorage } from './utils/api';

function App() {
  const [user, setUser] = useState(null);

  // Check localStorage for existing session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('graavitons_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        clearAuthStorage();
      }
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
    clearAuthStorage();
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
