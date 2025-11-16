// src/pages/DoctorDashboard.jsx
import React, { useEffect, useState } from 'react';
import useSocket from '../hooks/useSocket';
import { request } from '../utils/api';
import AppointmentCard from '../components/AppointmentCard';

export default function DoctorDashboard() {
  const [appointments, setAppointments] = useState([]);
  const todayStr = new Date().toISOString().slice(0,10);

  useEffect(()=>{ load(); }, []);

  async function load() {
    try {
      // use own ID for doctor endpoint; backend looks at token role too
      const raw = await request('/appointments'); // doctor will get their appts if role=doctor
      setAppointments(raw.appointments || []);
    } catch (e) { console.error(e); }
  }

  useSocket((ev, payload) => {
    if (['created','updated'].includes(ev)) load();
  });

  async function changeStatus(apptId, status) {
    try {
      await request(`/appointments/${apptId}/status`, { method: 'POST', body: JSON.stringify({ status }) });
      load();
    } catch (e) { alert(e.message || 'Error'); }
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Today's schedule</h2>

      <div className="space-y-3">
        {appointments.length === 0 && <div className="text-sm text-gray-500">No appointments</div>}
        {appointments.map(a => (
          <AppointmentCard key={a._id} appt={a} role="doctor" onAction={async (action, appt) => {
            if (action === 'inprogress') changeStatus(appt._id, 'InProgress');
            if (action === 'complete') changeStatus(appt._id, 'Completed');
          }} />
        ))}
      </div>
    </div>
  );
}
