// src/pages/PatientBooking.jsx
import React, { useEffect, useState } from 'react';
import { request } from '../utils/api';
import useSocket from '../hooks/useSocket';
import AppointmentCard from '../components/AppointmentCard';

export default function PatientBooking() {
  const [doctors, setDoctors] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState('');
  const [fromDate, setFromDate] = useState(new Date().toISOString().slice(0,10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0,10));
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [myAppointments, setMyAppointments] = useState([]);

  useEffect(()=> { loadDoctors(); loadMyAppointments(); }, []);

  async function loadDoctors() {
    try {
      const r = await request('/doctors');
      setDoctors(r.doctors || []);
      if (r.doctors && r.doctors.length && !selectedDoc) setSelectedDoc(r.doctors[0]._id);
    } catch (e) { console.error(e); }
  }

  async function loadSlots() {
    if (!selectedDoc) return;
    setLoading(true);
    try {
      const q = `/doctors/${selectedDoc}/availability?from=${fromDate}&to=${toDate}`;
      const r = await request(q);
      setSlots(r.slots || []);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  }

  async function loadMyAppointments() {
    try {
      const r = await request('/appointments');
      setMyAppointments(r.appointments || []);
    } catch (e) { console.error(e); }
  }

  async function handleBook(slot) {
    try {
      const payload = { doctorId: selectedDoc, startAt: slot.startAt.toISOString(), durationMin: 15, reason: 'Consult' };
      await request('/appointments', { method: 'POST', body: JSON.stringify(payload) });
      alert('Booked — check email for confirmation');
      loadSlots(); loadMyAppointments();
    } catch (e) {
      alert(e.message || 'Booking failed');
    }
  }

  // realtime updates
  useSocket((ev, payload) => {
    if (ev === 'created' || ev === 'updated') {
      // if appointment concerns me, refresh list
      const meId = null; // we don't need id; request() uses token for patient listing
      loadMyAppointments();
    }
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded shadow">
        <h3 className="text-lg font-semibold mb-2">Book an appointment</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select value={selectedDoc} onChange={e=>setSelectedDoc(e.target.value)} className="p-2 rounded border">
            {doctors.map(d => <option key={d._id} value={d._id}>{d.name} — {d.specialization || 'General'}</option>)}
          </select>
          <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} className="p-2 rounded border" />
          <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} className="p-2 rounded border" />
          <button onClick={loadSlots} className="px-4 py-2 rounded bg-emerald-600 text-white">Show slots</button>
        </div>
      </div>

      <div>
        <h4 className="text-md font-semibold mb-2">Available slots</h4>
        {loading && <div>Loading...</div>}
        {!loading && slots.length === 0 && <div className="text-sm text-gray-500">No slots</div>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {slots.map((s, idx) => (
            <div key={idx} className="bg-white p-3 rounded shadow flex justify-between items-center">
              <div>
                <div className="font-semibold">{new Date(s.startAt).toLocaleString()}</div>
                <div className="text-sm text-gray-600">{new Date(s.endAt).toLocaleTimeString()}</div>
              </div>
              <button onClick={()=>handleBook(s)} className="px-3 py-1 rounded bg-blue-600 text-white">Book</button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-lg font-semibold mb-2">My appointments</h4>
        <div className="space-y-3">
          {myAppointments.map(a => (
            <AppointmentCard key={a._id} appt={a} role="patient" onAction={async (act) => {
              if (act === 'cancel') {
                try {
                  await request(`/appointments/${a._id}/status`, { method: 'POST', body: JSON.stringify({ status:'Cancelled', cancelledReason: 'Cancelled by patient' }) });
                  loadMyAppointments();
                } catch (e) { alert(e.message || 'Error'); }
              }
            }} />
          ))}
          {myAppointments.length === 0 && <div className="text-sm text-gray-500">No appointments</div>}
        </div>
      </div>
    </div>
  );
}
