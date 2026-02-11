/**
 * Authenticated fetch wrapper for GRAAVITONS SMS Frontend.
 *
 * - Injects Authorization: Bearer <token> into every request.
 * - On 401, attempts a silent refresh using the stored refresh token.
 * - If refresh fails, clears storage and redirects to login.
 */

import { API_BASE } from '../config';

const TOKEN_KEY = 'graavitons_token';
const REFRESH_KEY = 'graavitons_refresh_token';

/**
 * Wrapper around fetch() that attaches the JWT access token and
 * transparently handles token refresh on 401 responses.
 *
 * @param {string} url – absolute or relative URL (relative will be prefixed with API_BASE)
 * @param {RequestInit} options – standard fetch options
 * @returns {Promise<Response>}
 */
export async function authFetch(url, options = {}) {
  const accessToken = localStorage.getItem(TOKEN_KEY);

  // Merge Authorization header
  const headers = new Headers(options.headers || {});
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let response = await fetch(url, { ...options, headers });

  // If 401, try to silently refresh the token once
  if (response.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Retry the original request with the new token
      const newToken = localStorage.getItem(TOKEN_KEY);
      headers.set('Authorization', `Bearer ${newToken}`);
      response = await fetch(url, { ...options, headers });
    } else {
      // Refresh failed → clear storage and redirect to login
      clearAuthStorage();
      window.location.href = '/';
      return response;
    }
  }

  return response;
}

/**
 * Attempt to obtain a new access token using the stored refresh token.
 * Returns true on success, false on failure.
 */
async function tryRefreshToken() {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    localStorage.setItem(TOKEN_KEY, data.access_token);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove all auth-related items from localStorage.
 */
export function clearAuthStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem('graavitons_user');
}
