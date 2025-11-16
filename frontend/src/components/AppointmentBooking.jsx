// src/components/AppointmentBooking.jsx
import React, { useEffect, useState } from "react";
import { request } from "../utils/api";

/*
Props:
 - doctorId (optional)
 - onBooked({ appointment }) callback
 - mode: 'patient' or 'reception' (affects which fields shown)
 - prefillPatient: {id, name, email} (optional, for receptionist)
*/
export default function AppointmentBooking({ doctorId: initialDoctorId, onBooked, mode = "patient", prefillPatient }) {
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState(initialDoctorId || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busy, setBusy] = useState(false);
  const [patientEmail, setPatientEmail] = useState(prefillPatient?.email || "");
  const [patientName, setPatientName] = useState(prefillPatient?.name || "");

  useEffect(() => {
    // load departments & doctors (simple endpoints expected)
    (async () => {
      try {
        const d = await request("/api/meta/departments").catch(()=>({departments:[]}));
        setDepartments(d.departments || []);
      } catch (e) { setDepartments([]); }
    })();
  }, []);

  useEffect(() => {
    // load doctors for selected department
    (async () => {
      try {
        if (!doctorId) {
          const all = await request("/api/users/doctors").catch(()=>({doctors:[]}));
          setDoctors(all.doctors || []);
        } else {
          // ensure doctor list contains this
          const all = await request("/api/users/doctors").catch(()=>({doctors:[]}));
          setDoctors(all.doctors || []);
        }
      } catch (e) {}
    })();
  }, [doctorId]);

  useEffect(() => {
    if (!doctorId || !date) return setSlots([]);
    setLoadingSlots(true);
    (async () => {
      try {
        const body = await request(`/api/appointments/slots?doctorId=${doctorId}&date=${date}`);
        setSlots(body.slots || []);
      } catch (e) {
        setSlots([]);
      } finally { setLoadingSlots(false); }
    })();
  }, [doctorId, date]);

  async function handleBook() {
    if (!doctorId || !selectedSlot) return alert("Select doctor and slot");
    if (mode === "reception" && !patientEmail) return alert("Enter patient email");
    setBusy(true);
    try {
      const payload = {
        doctorId,
        date,
        slot: selectedSlot,
        patient: mode === "reception" ? { name: patientName, email: patientEmail } : undefined,
      };
      const res = await request("/api/appointments/book", { method: "POST", body: JSON.stringify(payload) });
      setSelectedSlot("");
      onBooked && onBooked(res.appointment);
      alert("Appointment booked");
    } catch (e) {
      alert(e.message || "Booking failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-600">Doctor</label>
          <select value={doctorId} onChange={(e)=>setDoctorId(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2">
            <option value="">-- Select doctor --</option>
            {doctors.map(d => <option key={d._id} value={d._id}>{d.name} — {d.specialization}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600">Date</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" />
        </div>

        {mode === "reception" && (
          <>
            <div>
              <label className="block text-sm text-gray-600">Patient name</label>
              <input value={patientName} onChange={e=>setPatientName(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Patient email</label>
              <input value={patientEmail} onChange={e=>setPatientEmail(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" />
            </div>
          </>
        )}
      </div>

      <div className="mt-4">
        <div className="text-sm text-gray-600">Available slots</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {loadingSlots && <div className="text-sm text-gray-500">Loading slots…</div>}
          {!loadingSlots && slots.length === 0 && <div className="text-sm text-gray-500">No available slots</div>}
          {!loadingSlots && slots.map((s) => (
            <button
              key={s}
              onClick={()=>setSelectedSlot(s)}
              className={`px-3 py-2 border rounded ${selectedSlot===s ? 'bg-emerald-500 text-white':'bg-white text-gray-700'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={handleBook} disabled={busy} className="px-4 py-2 rounded bg-emerald-600 text-white">
          {busy ? 'Booking...' : 'Book appointment'}
        </button>
        <button onClick={() => { setDoctorId(''); setSelectedSlot(''); setSlots([]); }} className="px-4 py-2 rounded border">
          Reset
        </button>
      </div>
    </div>
  );
}
