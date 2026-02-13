/**
 * Centralized API configuration for GRAAVITONS SMS Frontend.
 * All API URLs are derived from environment variables.
 *
 * Local dev  : API_BASE = 'http://localhost:8000' (React dev server on :3000)
 * Production : API_BASE = '' (relative URLs, nginx proxies /api/ to backend)
 */

const isLocalDev =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const API_BASE = process.env.REACT_APP_API_BASE_URL !== undefined
  ? process.env.REACT_APP_API_BASE_URL
  : isLocalDev
    ? 'http://localhost:8000'
    : '';

const DEFAULT_AVATAR = process.env.REACT_APP_DEFAULT_AVATAR_URL || 'https://via.placeholder.com/150';

export { API_BASE, DEFAULT_AVATAR };
