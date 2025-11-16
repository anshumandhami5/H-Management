// src/pages/PatientDashboard.jsx
import React, { useEffect, useState } from 'react';
import useSocket from '../hooks/useSocket';
import { request } from '../utils/api';
import AppointmentCard from '../components/AppointmentCard';
import { Link } from 'react-router-dom';

export default function PatientDashboard() {
  const [appointments, setAppointments] = useState([]);

  useEffect(()=>{ load(); }, []);

  async function load() {
    try {
      const r = await request('/appointments');
      setAppointments(r.appointments || []);
    } catch (e) { console.error(e); }
  }

  useSocket((ev, payload) => {
    // for simplicity, reload list when anything relevant happens
    if (['created','updated'].includes(ev)) load();
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Your appointments</h2>
        <Link to="/book" className="px-4 py-2 bg-emerald-600 text-white rounded">Book now</Link>
      </div>

      <div className="space-y-3">
        {appointments.map(a => <AppointmentCard key={a._id} appt={a} role="patient" onAction={async (act) => {
          if (act === 'cancel') {
            try {
              await request(`/appointments/${a._id}/status`, { method: 'POST', body: JSON.stringify({ status:'Cancelled', cancelledReason: 'Patient cancelled' })});
              load();
            } catch (e) { alert(e.message || 'Error'); }
          }
        }} />)}
        {appointments.length === 0 && <div className="text-sm text-gray-500">No upcoming appointments</div>}
      </div>
    </div>
  );
}
