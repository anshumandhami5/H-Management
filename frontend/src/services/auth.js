// src/services/auth.js
const API_BASE = import.meta.env.VITE_API_BASE || '';

export async function loginApi({ email, password }) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include' // to receive refresh cookie
  });
  if (!res.ok) {
    const body = await res.json().catch(()=>({}));
    throw new Error(body.message || 'Login failed');
  }
  return res.json(); // { token, user }
}

export function saveAuth(payload){ localStorage.setItem('hms_auth', JSON.stringify(payload)); }
export function getAuth(){ try{return JSON.parse(localStorage.getItem('hms_auth'))}catch{return null} }
export function clearAuth(){ localStorage.removeItem('hms_auth'); }
export async function logoutApi() {
  await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
  clearAuth();
}
