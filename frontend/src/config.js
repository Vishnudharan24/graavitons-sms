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

const configuredApiBase = (process.env.REACT_APP_API_BASE_URL || '').trim();

const normalizeApiBase = (value) => {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
};

const normalizedConfiguredApiBase = normalizeApiBase(configuredApiBase);
const pointsToLocalhost = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedConfiguredApiBase);

// Safety guard:
// If build-time env accidentally sets localhost in a production deployment,
// force relative URLs so nginx can proxy /api/ correctly.
const API_BASE = normalizedConfiguredApiBase
  ? (!isLocalDev && pointsToLocalhost ? '' : normalizedConfiguredApiBase)
  : (isLocalDev ? 'http://localhost:8000' : '');

const DEFAULT_AVATAR = process.env.REACT_APP_DEFAULT_AVATAR_URL || 'https://via.placeholder.com/150';

export { API_BASE, DEFAULT_AVATAR };
