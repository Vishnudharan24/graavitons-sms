/**
 * Authenticated fetch wrapper for GRAAVITONS SMS.
 *
 * - Reads the JWT from localStorage and attaches it as a Bearer token.
 * - Automatically triggers logout on 401 responses (expired / invalid token).
 * - Provides the same API as native fetch().
 */

import { API_BASE } from '../config';

const TOKEN_KEY = 'graavitons_token';
const USER_KEY = 'graavitons_user';

// ── Token helpers ──

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ── Global logout callback ──
// App.js sets this so any 401 from any component triggers a full logout.
let _onUnauthorized = null;

export function setOnUnauthorized(callback) {
  _onUnauthorized = callback;
}

// ── Authenticated fetch ──

/**
 * Drop-in replacement for fetch() that attaches the JWT.
 *
 * @param {string} path  – API path, e.g. "/api/batch".  Absolute URLs also work.
 * @param {RequestInit} options – standard fetch options (method, body, headers…)
 * @returns {Promise<Response>}
 */
export async function authFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const token = getToken();

  const headers = {
    ...(options.headers || {}),
  };

  // Attach Authorization header if we have a token
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  // Auto-logout on 401
  if (response.status === 401) {
    clearAuth();
    if (_onUnauthorized) _onUnauthorized();
  }

  return response;
}

/**
 * Shorthand for JSON POST / PUT / PATCH with auth.
 */
export async function authJsonFetch(path, { method = 'POST', body, ...rest } = {}) {
  return authFetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(rest.headers || {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...rest,
  });
}
