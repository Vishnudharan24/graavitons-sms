import React, { useState } from 'react';
import './Login.css';
import { API_BASE } from '../config';

const Login = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    role: 'Teacher'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.username || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    if (isRegister && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const payload = isRegister
        ? { username: formData.username, password: formData.password, role: formData.role }
        : { username: formData.username, password: formData.password };

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      if (isRegister) {
        // After successful registration, switch to login
        setIsRegister(false);
        setFormData({ username: formData.username, password: '', confirmPassword: '', role: 'Teacher' });
        setError('');
        alert('Registration successful! Please log in.');
      } else {
        // Save tokens and user to localStorage, then notify parent
        localStorage.setItem('graavitons_token', data.access_token);
        localStorage.setItem('graavitons_refresh_token', data.refresh_token);
        localStorage.setItem('graavitons_user', JSON.stringify(data.user));
        onLogin(data.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setError('');
    setFormData({ username: '', password: '', confirmPassword: '', role: 'Teacher' });
  };

  return (
    <div className="login-page">
      <img
        src="/logo.png"
        alt="Graavitons Logo"
        className="login-logo"
      />
      <div className="login-container">
        {/* <div className="login-brand">
          <h1>GRAAVITONS</h1>
          <p>Student Management System</p>
        </div> */}

        <div className="login-card">
          <h2>{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
          <p className="login-subtitle">
            {isRegister ? 'Register a new account' : 'Sign in to your account'}
          </p>

          {error && (
            <div className="login-error">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label>Username</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter your username"
                required
                autoFocus
              />
            </div>

            <div className="login-field">
              <label>Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                required
              />
            </div>

            {isRegister && (
              <>
                <div className="login-field">
                  <label>Confirm Password</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    required
                  />
                </div>

                <div className="login-field">
                  <label>Role</label>
                  <select name="role" value={formData.role} onChange={handleChange}>
                    <option value="Admin">Admin</option>
                    <option value="Teacher">Teacher</option>
                  </select>
                </div>
              </>
            )}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading
                ? (isRegister ? 'Creating Account...' : 'Signing In...')
                : (isRegister ? 'Create Account' : 'Sign In')
              }
            </button>
          </form>

          <div className="login-toggle">
            {isRegister ? (
              <p>Already have an account? <button onClick={toggleMode}>Sign In</button></p>
            ) : (
              <p>Don't have an account? <button onClick={toggleMode}>Create Account</button></p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
