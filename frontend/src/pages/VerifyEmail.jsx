// src/pages/VerifyEmail.jsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  const [status, setStatus] = useState('pending'); // pending | success | error
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!token || !email) {
      setStatus('error');
      setMessage('Invalid verification link — missing token or email.');
      return;
    }

    (async () => {
      try {
        const BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000';
        // call backend verify endpoint
        const res = await fetch(`${BASE}/api/auth/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`, {
          method: 'GET'
        });

        if (res.ok) {
          setStatus('success');
          setMessage('Email verified — you can now sign in.');
          // optional: auto-redirect to login in 2.5s
          setTimeout(() => navigate('/login?verified=1'), 2500);
        } else {
          const body = await res.json().catch(()=>({}));
          setStatus('error');
          setMessage(body.message || 'Verification failed. Token may be expired or invalid.');
        }
      } catch (err) {
        setStatus('error');
        setMessage(err.message || 'Network error while verifying email.');
      }
    })();
  }, [token, email, navigate]);

  return (
    <div style={{ maxWidth: 760, margin: '48px auto', padding: 28 }}>
      <div style={{ background: 'white', padding: 28, borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
        <h1 style={{ marginTop: 0 }}>Email verification</h1>

        {status === 'pending' && (
          <div>
            <p>Verifying your email — please wait...</p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <p style={{ color: '#059669', fontWeight: 700 }}>{message}</p>
            <p>Redirecting to sign-in… If you are not redirected automatically, <Link to="/login">click here to sign in</Link>.</p>
          </div>
        )}

        {status === 'error' && (
          <div>
            <p style={{ color: '#ef4444', fontWeight: 700 }}>{message}</p>
            <p>If you didn't receive a working link, try clicking <a href="/login">Resend verification</a> or contact admin.</p>
          </div>
        )}
      </div>
    </div>
  );
}
