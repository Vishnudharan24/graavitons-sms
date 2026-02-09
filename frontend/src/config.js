/**
 * Centralized API configuration for GRAAVITONS SMS Frontend.
 * All API URLs are derived from environment variables.
 */

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
const DEFAULT_AVATAR = process.env.REACT_APP_DEFAULT_AVATAR_URL || 'https://via.placeholder.com/150';

export { API_BASE, DEFAULT_AVATAR };
