import React, { useEffect, useState } from 'react';
const [appointments, setAppointments] = useState([]);
const [loading, setLoading] = useState(false);


async function load(){
if (!user) return;
setLoading(true);
try {
const res = await fetcher(`/doctor/${user._id}/appointments?date=${date}`);
setAppointments(res.appointments || []);
} catch (err) { console.error(err); }
finally { setLoading(false); }
}


useEffect(()=>{ load(); }, [date, user]);


useEffect(()=>{
if (!socket) return;
const onCreated = (appt) => {
if (String(appt.doctorId) === String(user._id) || appt.doctorId?._id === user._id) {
setAppointments(prev => [...prev, appt].sort((a,b)=>new Date(a.startAt)-new Date(b.startAt)));
}
};
const onUpdated = (appt) => {
setAppointments(prev => prev.map(p => p._id === appt._id ? appt : p));
};
socket.on('appointment.created', onCreated);
socket.on('appointment.updated', onUpdated);
return ()=>{
socket.off('appointment.created', onCreated);
socket.off('appointment.updated', onUpdated);
};
}, [socket, user]);


async function changeStatus(id, status){
try {
await fetcher(`/appointments/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
} catch (err) { alert(err.message || 'Failed'); }
}


return (
<div className="max-w-4xl mx-auto p-6 bg-white rounded shadow">
<div className="flex items-center justify-between mb-4">
<h2 className="text-xl font-semibold">My schedule</h2>
<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="rounded border px-3 py-2" />
</div>


{loading ? <div>Loading…</div> : (
<div className="space-y-3">
{appointments.map(a => (
<div key={a._id} className="p-3 border rounded flex justify-between items-center">
<div>
<div className="font-semibold">{a.patientId?.name || 'Patient'}</div>
<div className="text-sm text-gray-600">{new Date(a.startAt).toLocaleString()} — {a.reason || '-'}</div>
</div>
<div className="flex items-center gap-2">
<div className="px-3 py-1 rounded text-sm font-medium bg-gray-100">{a.status}</div>
{a.status === 'Booked' && <button onClick={()=>changeStatus(a._id,'InProgress')} className="px-3 py-1 bg-amber-500 text-white rounded">Start</button>}
{a.status === 'InProgress' && <button onClick={()=>changeStatus(a._id,'Completed')} className="px-3 py-1 bg-emerald-600 text-white rounded">Complete</button>}
</div>
</div>
))}
{appointments.length===0 && <div className="text-center text-gray-500 p-6">No appointments for this day</div>}
</div>
)}
</div>
);
}