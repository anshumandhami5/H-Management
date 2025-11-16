// src/utils/api.js
import { getAuth, saveAuth, clearAuth } from '../services/auth';

const API_BASE = import.meta.env.VITE_API_BASE || '';

// Try to read token (helper)
function currentToken() {
  try {
    const a = getAuth();
    return a?.token || null;
  } catch (e) {
    return null;
  }
}

// Try refresh; if successful it will update localStorage.hms_auth and return true
async function tryRefresh() {
  try {
    const r = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!r.ok) return false;
    const body = await r.json();
    // body: { token: newAccessToken }
    // merge into existing auth object (keep user)
    const raw = JSON.parse(localStorage.getItem('hms_auth') || 'null') || {};
    raw.token = body.token;
    localStorage.setItem('hms_auth', JSON.stringify(raw));
    console.debug('[api] refresh succeeded, new token saved');
    return true;
  } catch (e) {
    console.debug('[api] refresh failed', e);
    return false;
  }
}

async function fetcher(url, opts = {}) {
  const full = url.startsWith('http') ? url : `${API_BASE}${url}`;

  // If there's no token in storage, try a refresh first (handles case when token wasn't saved or expired)
  let token = currentToken();
  if (!token) {
    // attempt refresh once
    const refreshed = await tryRefresh();
    if (refreshed) token = currentToken();
  }

  const headers = Object.assign({}, opts.headers || {}, { 'Content-Type': 'application/json' });
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const fetchOpts = Object.assign({}, opts, { headers, credentials: 'include' }); // include cookies
  console.debug('[api] fetch', full, fetchOpts);

  let res = await fetch(full, fetchOpts);

  // handle 401: try refresh once (in case access token expired)
  if (res.status === 401) {
    console.debug('[api] got 401, attempting refresh and retry');
    const refreshed = await tryRefresh();
    if (refreshed) {
      // rebuild headers with new token
      const newToken = currentToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
      } else {
        delete headers['Authorization'];
      }
      res = await fetch(full, Object.assign({}, opts, { headers, credentials: 'include' }));
    } else {
      // cannot refresh: clear and redirect to login
      clearAuth();
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
  }

  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }

  if (!res.ok) {
    const message = (body && body.message) ? body.message : (res.statusText || 'Request failed');
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return body;
}

export async function request(url, opts = {}) {
  return fetcher(url, opts);
}

export default fetcher;
