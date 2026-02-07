import React from 'react';
import './App.css';
import Header from './components/Header';
import Dashboard from './components/Dashboard';

function App() {
  return (
    <div className="app">
      <div className="main-content">
        <Header />
        <Dashboard />
      </div>
    </div>
  );
}

export default App;
