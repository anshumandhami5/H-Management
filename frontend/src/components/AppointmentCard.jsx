// src/components/AppointmentCard.jsx
import React from 'react';
import { format } from 'date-fns';

export default function AppointmentCard({ appt, role, onAction }) {
  // appt: populated appointment { _id, startAt, endAt, status, doctorId: {name}, patientId:{name}, reason }
  const start = new Date(appt.startAt);
  const time = format(start, 'PPP p');

  return (
    <div className="bg-white rounded shadow p-4 flex items-start justify-between">
      <div>
        <div className="text-sm text-gray-500">{time}</div>
        <div className="font-semibold text-lg">
          {role === 'doctor' ? appt.patientId?.name : appt.doctorId?.name}
        </div>
        <div className="text-sm text-gray-600">{appt.reason || '—'}</div>
      </div>

      <div className="flex flex-col items-end gap-2">
        <div className="text-sm px-3 py-1 rounded-full text-white"
             style={{ background: statusColor(appt.status) }}>
          {appt.status}
        </div>

        <div className="flex gap-2">
          {role === 'reception' && appt.status === 'Booked' && (
            <button onClick={() => onAction('arrive', appt)} className="px-3 py-1 rounded border">Mark arrived</button>
          )}
          {role === 'doctor' && ['Arrived','InProgress','Booked'].includes(appt.status) && (
            <>
              {appt.status !== 'InProgress' && <button onClick={() => onAction('inprogress', appt)} className="px-3 py-1 rounded border">Start</button>}
              <button onClick={() => onAction('complete', appt)} className="px-3 py-1 rounded bg-emerald-600 text-white">Complete</button>
            </>
          )}
          {role === 'patient' && appt.status === 'Booked' && (
            <button onClick={() => onAction('cancel', appt)} className="px-3 py-1 rounded border">Cancel</button>
          )}
        </div>
      </div>
    </div>
  );
}

function statusColor(s) {
  switch (s) {
    case 'Booked': return '#0ea5a4';
    case 'Arrived': return '#f59e0b';
    case 'InProgress': return '#3b82f6';
    case 'Completed': return '#059669';
    case 'Cancelled': return '#ef4444';
    case 'NoShow': return '#6b7280';
    default: return '#0ea5a4';
  }
}
