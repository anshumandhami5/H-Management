// src/pages/ReceptionDashboard.jsx
import React, { useEffect, useState } from 'react';
import useSocket from '../hooks/useSocket';
import { request } from '../utils/api';
import AppointmentCard from '../components/AppointmentCard';

export default function ReceptionDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ doctorId:'', patientEmail:'', patientName:'', startAt: '', reason:'' });

  useEffect(()=>{ load(); loadDoctors(); }, []);

  async function load() {
    try {
      const r = await request('/appointments'); // receptionist gets all if backend allows
      setAppointments(r.appointments || []);
    } catch (e) { console.error(e); }
  }
  async function loadDoctors(){
    try {
      const r = await request('/doctors');
      setDoctors(r.doctors || []);
      if (r.doctors && r.doctors.length) setForm(f => ({...f, doctorId: r.doctors[0]._id}));
    } catch (e) { console.error(e); }
  }

  useSocket((ev, payload) => {
    if (['created','updated'].includes(ev)) load();
  });

  async function addAppt(e) {
    e.preventDefault();
    try {
      const { doctorId, patientName, patientEmail, startAt, reason } = form;
      if (!doctorId || !patientEmail || !startAt) return alert('fill doctor, email and start time');
      await request('/appointments', { method: 'POST', body: JSON.stringify({ doctorId, startAt, durationMin:15, reason }) });
      setForm({ doctorId:'', patientEmail:'', patientName:'', startAt:'', reason:'' });
      setCreating(false);
      load();
    } catch (err) { alert(err.message || 'Error'); }
  }

  async function doAction(action, appt) {
    try {
      if (action === 'arrive') {
        await request(`/appointments/${appt._id}/status`, { method:'POST', body: JSON.stringify({ status:'Arrived' })});
      }
      load();
    } catch (e) { alert(e.message || 'Error'); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Reception — Live board</h2>
        <button onClick={()=>setCreating(v=>!v)} className="px-4 py-2 rounded bg-emerald-600 text-white">{creating ? 'Close' : 'Create appointment'}</button>
      </div>

      {creating && (
        <form onSubmit={addAppt} className="bg-white p-4 rounded shadow space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select value={form.doctorId} onChange={e=>setForm(f=>({...f, doctorId:e.target.value}))} className="p-2 rounded border">
              {doctors.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
            <input placeholder="Patient name" value={form.patientName} onChange={e=>setForm(f=>({...f, patientName:e.target.value}))} className="p-2 rounded border"/>
            <input placeholder="Patient email" value={form.patientEmail} onChange={e=>setForm(f=>({...f, patientEmail:e.target.value}))} className="p-2 rounded border"/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input type="datetime-local" value={form.startAt} onChange={e=>setForm(f=>({...f, startAt:e.target.value}))} className="p-2 rounded border"/>
            <input placeholder="Reason" value={form.reason} onChange={e=>setForm(f=>({...f, reason:e.target.value}))} className="p-2 rounded border"/>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={()=>setCreating(false)} className="px-3 py-1 rounded border">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded bg-emerald-600 text-white">Create</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {appointments.map(a => (
          <AppointmentCard key={a._id} appt={a} role="reception" onAction={(act, appt)=> {
            if (act === 'arrive') doAction('arrive', appt);
          }} />
        ))}
      </div>
    </div>
  );
}
