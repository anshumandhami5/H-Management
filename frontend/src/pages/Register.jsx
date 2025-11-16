// src/pages/Register.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name:'', email:'', password:'', confirm:'' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  function onChange(e){ setForm({...form, [e.target.name]: e.target.value}); }

  async function submit(e){
    e.preventDefault();
    setErr('');
    if (form.password !== form.confirm) { setErr('Passwords do not match'); return; }
    if (form.password.length < 6) { setErr('Password must be at least 6 characters'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password })
      });

      if (!res.ok) {
        const body = await res.json().catch(()=>({}));
        throw new Error(body.message || 'Registration failed');
      }

      alert('Registration successful. Please check your email for a verification link.');
      navigate('/login');
    } catch (err) {
      setErr(err.message);
    } finally { setLoading(false); }
  }

  return (
    <div style={{maxWidth:480, margin:'48px auto', padding:20}}>
      <h2>Create your account</h2>
      <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:12}}>
        <input name="name" placeholder="Full name" value={form.name} onChange={onChange} required />
        <input name="email" placeholder="Email" type="email" value={form.email} onChange={onChange} required />
        <input name="password" placeholder="Password" type="password" value={form.password} onChange={onChange} required />
        <input name="confirm" placeholder="Confirm password" type="password" value={form.confirm} onChange={onChange} required />
        <button disabled={loading}>{loading ? 'Registering...' : 'Create account'}</button>
        {err && <div style={{color:'red'}}>{err}</div>}
      </form>
    </div>
  );
}
