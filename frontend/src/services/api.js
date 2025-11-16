// src/utils/api.js
import { getAuth, saveAuth, clearAuth } from '../services/auth';

const API_BASE = import.meta.env.VITE_API_BASE || '';

async function fetcher(url, opts = {}) {
  const full = url.startsWith('http') ? url : `${API_BASE}${url}`;
  const auth = getAuth();
  const headers = Object.assign({}, opts.headers || {}, { 'Content-Type': 'application/json' });
  if (auth?.token) headers['Authorization'] = `Bearer ${auth.token}`;

  const fetchOpts = Object.assign({}, opts, { headers, credentials: 'include' }); // include cookies
  let res = await fetch(full, fetchOpts);

  if (res.status === 401) {
    // try refresh once
    const refreshed = await tryRefresh();
    if (refreshed) {
      const tok = getAuth()?.token;
      if (tok) headers['Authorization'] = `Bearer ${tok}`;
      res = await fetch(full, Object.assign({}, opts, { headers, credentials: 'include' }));
    } else {
      clearAuth();
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
  }

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = body?.message || res.statusText || 'Request failed';
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return body;
}

async function tryRefresh() {
  try {
    const r = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // send refresh cookie
    });
    if (!r.ok) return false;
    const body = await r.json();
    // body: { token: newAccessToken }
    const raw = JSON.parse(localStorage.getItem('hms_auth') || 'null') || {};
    raw.token = body.token;
    localStorage.setItem('hms_auth', JSON.stringify(raw));
    return true;
  } catch (e) {
    return false;
  }
}

export async function request(url, opts = {}) {
  return fetcher(url, opts);
}

export default fetcher;
