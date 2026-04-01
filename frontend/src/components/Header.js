import React from 'react';
import './Header.css';
import { startHelpTour } from '../utils/helpTour';

const Header = ({ user, onLogout }) => {
  return (
    <header className="header">
      <div className="header-content">
        <h1 className="college-name">GRAAVITONS STUDENT MANAGEMENT SYSTEM</h1>
        {user && (
          <div className="header-user">
            <div className="user-info">
              <span className="user-role-badge">{user.role || 'User'}</span>
              <span className="user-email">{user.username}</span>
            </div>
            <button className="btn btn-ghost help-btn" onClick={startHelpTour}>
              Help
            </button>
            <button className="btn btn-danger logout-btn" onClick={onLogout}>
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
