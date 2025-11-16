// frontend/src/pages/ChangePassword.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import fetcher from '../utils/api';
import { clearAuth } from '../services/auth';

export default function ChangePassword() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(null);
    if (!current || !pw) return setMsg({ type: 'error', text: 'Please fill all fields' });
    if (pw.length < 6) return setMsg({ type: 'error', text: 'New password must be 6+ chars' });
    if (pw !== confirm) return setMsg({ type: 'error', text: 'Passwords do not match' });

    setLoading(true);
    try {
      const body = await fetcher('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: pw })
      });
      // success: clear auth (force re-login)
      clearAuth();
      setMsg({ type: 'success', text: body.message || 'Password changed. Please sign in again.' });
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Change failed' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-16 p-8 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-2">Change your password</h2>
      <p className="text-sm text-gray-500 mb-6">You were issued a temporary password. Choose a new secure password.</p>

      {msg && (
        <div className={`p-3 rounded mb-4 ${msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {msg.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm text-gray-600">Temporary / current password</label>
          <input
            type={show ? 'text' : 'password'}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="mt-1 block w-full rounded border px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="text-sm text-gray-600">New password</label>
          <input
            type={show ? 'text' : 'password'}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="mt-1 block w-full rounded border px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="text-sm text-gray-600">Confirm new password</label>
          <input
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 block w-full rounded border px-3 py-2"
            required
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={show} onChange={() => setShow(!show)} />
              <span className="text-gray-600">Show passwords</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white rounded font-semibold"
          >
            {loading ? 'Saving...' : 'Change password'}
          </button>
        </div>
      </form>
    </div>
  );
}
