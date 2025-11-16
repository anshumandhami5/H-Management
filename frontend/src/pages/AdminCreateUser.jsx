// src/pages/AdminCreateUser.jsx
import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider'; // assumes existing provider

export default function AdminCreateUser() {
  const { user } = useAuth(); // must be admin
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'doctor' });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(false);

  function onChange(e){ setForm({...form, [e.target.name]: e.target.value}); }

  async function submit(e){
    e.preventDefault();
    setErr(''); setOk('');
    if (!form.name || !form.email || !form.password || !form.role) { setErr('All fields required'); return; }
    setLoading(true);
    try {
      const raw = JSON.parse(localStorage.getItem('hms_auth') || 'null') || {};
      const token = raw.token;

      const res = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password, role: form.role })
      });

      if (!res.ok) {
        const body = await res.json().catch(()=>({}));
        throw new Error(body.message || 'Create user failed');
      }
      const body = await res.json();
      setOk('User created successfully');
      setForm({ name:'', email:'', password:'', role:'doctor' });
    } catch (err) {
      setErr(err.message);
    } finally { setLoading(false); }
  }

  return (
    <div style={{maxWidth:760, margin:'24px auto', padding:18}}>
      <h2>Create staff user</h2>
      <p className="muted">Admins can create doctor or receptionist accounts</p>

      <form onSubmit={submit} style={{display:'flex', gap:12, flexWrap:'wrap'}}>
        <input name="name" placeholder="Name" value={form.name} onChange={onChange} required />
        <input name="email" placeholder="Email" value={form.email} onChange={onChange} required />
        <input name="password" placeholder="Password" type="password" value={form.password} onChange={onChange} required />
        <select name="role" value={form.role} onChange={onChange}>
          <option value="doctor">Doctor</option>
          <option value="reception">Reception</option>
          <option value="pharmacist">Pharmacist</option>
        </select>

        <div style={{width:'100%', marginTop:8}}>
          <button disabled={loading}>{loading ? 'Creating...' : 'Create user'}</button>
          {err && <div style={{color:'red'}}>{err}</div>}
          {ok && <div style={{color:'green'}}>{ok}</div>}
        </div>
      </form>
    </div>
  );
}
