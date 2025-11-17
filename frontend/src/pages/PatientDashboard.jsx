// src/pages/PatientDashboard.jsx
import React, { useEffect, useRef, useState } from "react";
import useSocket from "../hooks/useSocket";
import { request } from "../utils/api";
import { useAuth } from "../components/AuthProvider";

/**
 * PatientDashboard
 * - Shows doctors list (left)
 * - Shows available slots for selected doctor (middle)
 * - Booking form modal to provide name, phone, email (stores in appointment payload)
 * - My appointments list (right)
 *
 * Notes:
 * - Uses GET /api/doctors and GET /api/doctors/:id/slots
 * - Books via POST /api/appointments with doctorId,startAt,patientName,patientEmail,patientPhone,durationMin
 */

function fmt(dt) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

export default function PatientDashboard() {
  const { logout } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const selectedDocRef = useRef(null); // keep latest for socket callbacks

  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [showBooking, setShowBooking] = useState(false);
  const [bookingSlot, setBookingSlot] = useState(null);

  const [form, setForm] = useState({ name: "", phone: "", email: "" });

  const [myAppointments, setMyAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  // keep ref updated so socket handler always sees latest selected doc
  useEffect(() => {
    selectedDocRef.current = selectedDoc;
  }, [selectedDoc]);

  // real-time updates: ensure handler uses refs so it doesn't close over stale state
  useSocket((ev, payload) => {
    if (!ev) return;
    const interesting = [
      "slot:created",
      "slot:updated",
      "appointment:created",
      "appointment:cancelled",
      "appointment:updated"
    ];
    if (!interesting.includes(ev)) return;

    // reload slots for currently selected doctor (if any)
    const doc = selectedDocRef.current;
    if (doc && doc._id) loadSlots(doc._id);

    // reload appointments for this patient
    loadMyAppointments();
  });

  useEffect(() => {
    loadDoctors();
    loadMyAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedDoc) loadSlots(selectedDoc._id);
    else setSlots([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoc]);

  async function loadDoctors() {
    try {
      const res = await request("/api/doctors");
      setDoctors(res.doctors || []);
      if (res.doctors && res.doctors.length && !selectedDoc) setSelectedDoc(res.doctors[0]);
    } catch (err) {
      console.error("loadDoctors:", err);
      alert(err?.message || "Failed to load doctors");
    }
  }

  async function loadSlots(doctorId = selectedDoc?._id) {
    if (!doctorId) return;
    setLoadingSlots(true);
    try {
      const res = await request(`/api/doctors/${doctorId}/slots`);
      const all = res.slots || [];
      const available = all
        .filter((s) => (s.status || "").toLowerCase() === "available")
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
      setSlots(available);
    } catch (err) {
      console.error("loadSlots:", err);
      alert(err?.message || "Failed to load slots");
    } finally {
      setLoadingSlots(false);
    }
  }

  async function loadMyAppointments() {
    setLoadingAppointments(true);
    try {
      const res = await request("/api/appointments");
      setMyAppointments(res.appointments || []);
    } catch (err) {
      console.error("loadMyAppointments:", err);
      // If unauthorized, force logout to let user re-auth (backend-dependent)
      if (err && err.status === 401) {
        logout();
      }
    } finally {
      setLoadingAppointments(false);
    }
  }

  function openBookingModal(slot) {
    setBookingSlot(slot);
    setForm({ name: "", phone: "", email: "" });
    setShowBooking(true);
  }

  async function handleBook(e) {
    e.preventDefault();
    if (!bookingSlot || !selectedDoc) return alert("No slot selected.");
    if (!form.name || !form.email) return alert("Please enter name and email (phone optional).");

    try {
      const payload = {
        doctorId: selectedDoc._id,
        startAt: bookingSlot.startAt,
        durationMin: bookingSlot.durationMin || 15,
        patientName: form.name,
        patientEmail: form.email,
        patientPhone: form.phone // backend may ignore until implemented
      };

      const res = await request("/api/appointments", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      // If backend returns created appointment, add it to local list. Otherwise reload.
      if (res && res.appointment) {
        setMyAppointments((prev) => [res.appointment, ...prev]);
      } else {
        // fallback: reload from server
        await loadMyAppointments();
      }

      // remove booked slot locally so slots update immediately
      setSlots((prev) => prev.filter((s) => {
        // if slot objects have id use _id, otherwise compare startAt
        if (s._id && bookingSlot._id) return s._id !== bookingSlot._id;
        return s.startAt !== bookingSlot.startAt;
      }));

      alert("Booked — check email for confirmation.");
      setShowBooking(false);
      setBookingSlot(null);
      setForm({ name: "", phone: "", email: "" });

      // attempt to refresh slots from server to ensure canonical state
      loadSlots(selectedDoc._id);
    } catch (err) {
      console.error("booking:", err);
      // If backend returns created appointment inside error path, still try to refresh
      alert(err?.message || "Booking failed");
      // best-effort reload so UI doesn't stay stale
      loadSlots(selectedDoc?._id);
      loadMyAppointments();
    }
  }

  async function handleCancelAppointment(a) {
    if (!a || !a._id) return;
    if (!confirm("Cancel this appointment?")) return;
    try {
      await request(`/api/appointments/${a._id}/cancel`, { method: "POST" });
      // optimistically mark cancelled locally (if backend doesn't immediately include in socket)
      setMyAppointments((prev) => prev.map((it) => (it._id === a._id ? { ...it, status: "Cancelled" } : it)));
      loadMyAppointments();
    } catch (err) {
      console.error("cancel:", err);
      alert(err?.message || "Cancel failed");
    }
  }

  return (
    <div className="min-h-screen p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Patient — Book a slot</h1>
          <p className="text-sm text-gray-500">Choose a doctor and select an available slot</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={logout} className="px-3 py-2 rounded border">Logout</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* doctors list */}
        <aside className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Doctors</h3>
          <div className="space-y-2">
            {doctors.map((d) => (
              <button
                key={d._id}
                onClick={() => setSelectedDoc(d)}
                className={`w-full text-left p-3 rounded-md hover:bg-gray-50 ${selectedDoc?._id === d._id ? "ring-2 ring-emerald-200 bg-emerald-50" : ""}`}
              >
                <div className="font-medium">{d.name}</div>
                <div className="text-xs text-gray-500">{d.specialization || "General"}</div>
              </button>
            ))}
            {doctors.length === 0 && <div className="text-sm text-gray-500">No doctors found</div>}
          </div>
        </aside>

        {/* slots */}
        <section className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Selected</div>
                <div className="text-lg font-semibold">{selectedDoc ? `${selectedDoc.name} — ${selectedDoc.specialization || 'General'}` : 'No doctor selected'}</div>
              </div>
              <div>
                <button onClick={() => loadSlots(selectedDoc?._id)} className="px-3 py-1 rounded border">Refresh</button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="p-3 text-sm text-gray-500">Available slots</div>
            {loadingSlots ? (
              <div className="p-6 text-center text-gray-500">Loading…</div>
            ) : slots.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No available slots</div>
            ) : (
              <div className="divide-y">
                {slots.map((s) => (
                  <div key={s._id || s.startAt} className="flex items-center justify-between p-3">
                    <div>
                      <div className="font-medium">{fmt(s.startAt)}</div>
                      <div className="text-xs text-gray-500">{(s.durationMin || 15) + ' min'}</div>
                    </div>
                    <div>
                      <button onClick={() => openBookingModal(s)} className="px-3 py-1 rounded bg-emerald-600 text-white">Book</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* my appointments */}
        <aside className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-600">My appointments</h3>
            <button onClick={loadMyAppointments} className="text-xs text-gray-500">Refresh</button>
          </div>

          <div className="space-y-3">
            {loadingAppointments && <div className="text-sm text-gray-500">Loading…</div>}
            {!loadingAppointments && myAppointments.length === 0 && <div className="text-sm text-gray-500">No appointments</div>}
            {myAppointments.map((a) => {
              const status = a.status ? String(a.status) : "Booked";
              const isCancelled = status.toLowerCase() === "cancelled";
              return (
                <div key={a._id || `${a.doctorId}_${a.startAt}`} className="p-3 border rounded">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-medium">{a.doctorName || a.doctorId || 'Doctor'}</div>
                      <div className="text-sm text-gray-600">{fmt(a.startAt)}</div>
                    </div>
                    <div className="text-sm">
                      <div className="text-xs text-gray-500">{status}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 mt-2">Reason: {a.reason || '-'}</div>
                  <div className="flex gap-2 mt-3">
                    {!isCancelled && (
                      <button
                        onClick={() => handleCancelAppointment(a)}
                        className="px-3 py-1 rounded border text-sm text-rose-600"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Booking modal */}
      {showBooking && bookingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg w-full max-w-md p-5">
            <h3 className="text-lg font-semibold mb-3">Book slot — {fmt(bookingSlot.startAt)}</h3>
            <form onSubmit={handleBook} className="space-y-3">
              <div>
                <label className="text-sm text-gray-600">Full name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1 block w-full rounded border px-3 py-2" />
              </div>
              <div>
                <label className="text-sm text-gray-600">Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="mt-1 block w-full rounded border px-3 py-2" />
              </div>
              <div>
                <label className="text-sm text-gray-600">Email</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" className="mt-1 block w-full rounded border px-3 py-2" />
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => { setShowBooking(false); setBookingSlot(null); }} className="px-3 py-2 rounded border">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded bg-emerald-600 text-white">Confirm booking</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
