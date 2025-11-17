// src/pages/PatientDashboard.jsx
import React, { useEffect, useRef, useState } from "react";
import useSocket from "../hooks/useSocket";
import { request } from "../utils/api";
import { useAuth } from "../components/AuthProvider";

/**
 * PatientDashboard — Premium Hospital UI
 *
 * UI-only changes: improved header, doctor cards with avatar, gradient accents,
 * slot tiles, modern modal with blur overlay, appointment cards with badges,
 * better empty states and responsive layout. No logic or API changes.
 */

function fmt(dt) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function initials(name = "") {
  const parts = (name || "").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function StatusPill({ status }) {
  const s = String(status || "").toLowerCase();
  if (s === "cancelled") return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">Cancelled</span>;
  if (s === "arrived") return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-100">Arrived</span>;
  if (s === "inprogress") return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-100">In progress</span>;
  if (s === "complet" || s === "completed") return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">Completed</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-600 text-white">Booked</span>;
}

export default function PatientDashboard() {
  const { logout } = useAuth();

  // data state
  const [doctors, setDoctors] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const selectedDocRef = useRef(null);

  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [showBooking, setShowBooking] = useState(false);
  const [bookingSlot, setBookingSlot] = useState(null);

  const [form, setForm] = useState({ name: "", phone: "", email: "" });

  const [myAppointments, setMyAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  // keep ref updated for socket handlers
  useEffect(() => { selectedDocRef.current = selectedDoc; }, [selectedDoc]);

  // socket: respond to server events (no logic change)
  useSocket((ev, payload) => {
    if (!ev) return;
    const interesting = [
      "slot:created",
      "slot:updated",
      "appointment:created",
      "appointment:cancelled",
      "appointment:updated",
    ];
    // also accept dot-variants
    const norm = String(ev).replace(/\./g, ":");
    if (!interesting.includes(norm)) return;

    const doc = selectedDocRef.current;
    if (doc && doc._id) loadSlots(doc._id);
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

  // ------------- API loaders (unchanged) ----------------
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
      if (err && err.status === 401) logout();
    } finally {
      setLoadingAppointments(false);
    }
  }

  // ------------- booking flow (unchanged behavior) ----------------
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
        patientPhone: form.phone,
      };

      const res = await request("/api/appointments", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res && res.appointment) {
        setMyAppointments((prev) => [res.appointment, ...prev]);
      } else {
        await loadMyAppointments();
      }

      setSlots((prev) =>
        prev.filter((s) => {
          if (s._id && bookingSlot._id) return s._id !== bookingSlot._id;
          return s.startAt !== bookingSlot.startAt;
        })
      );

      setShowBooking(false);
      setBookingSlot(null);
      setForm({ name: "", phone: "", email: "" });
      alert("Booked — check email for confirmation.");
      loadSlots(selectedDoc._id);
    } catch (err) {
      console.error("booking:", err);
      alert(err?.message || "Booking failed");
      loadSlots(selectedDoc?._id);
      loadMyAppointments();
    }
  }

  async function handleCancelAppointment(a) {
    if (!a || !a._id) return;
    if (!confirm("Cancel this appointment?")) return;
    try {
      await request(`/api/appointments/${a._id}/cancel`, { method: "POST" });
      setMyAppointments((prev) => prev.map((it) => (it._id === a._id ? { ...it, status: "Cancelled" } : it)));
      loadMyAppointments();
    } catch (err) {
      console.error("cancel:", err);
      alert(err?.message || "Cancel failed");
    }
  }

  // ---------------- UI ----------------
  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-sky-400 flex items-center justify-center shadow-lg">
              <span className="text-white text-2xl font-bold">🏥</span>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800">Patient Portal</h1>
              <p className="text-sm text-slate-500">Book appointments, view your upcoming visits, and manage bookings.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { loadDoctors(); loadSlots(selectedDoc?._id); loadMyAppointments(); }}
              className="px-4 py-2 rounded-md border bg-white hover:bg-gray-50 text-sm"
            >
              Refresh
            </button>

            <button
              onClick={logout}
              className="px-4 py-2 rounded-md bg-white border hover:bg-gray-50 text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        {/* LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: Doctors list */}
          <aside className="lg:col-span-1 bg-white rounded-2xl border p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">Doctors</h3>
              <button onClick={loadDoctors} className="text-xs text-slate-500">Reload</button>
            </div>

            <div className="space-y-3">
              {doctors.length === 0 && <div className="text-sm text-gray-500">No doctors found</div>}
              {doctors.map((d) => (
                <button
                  key={d._id}
                  onClick={() => setSelectedDoc(d)}
                  className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-shadow ${selectedDoc?._id === d._id ? "ring-2 ring-emerald-200 bg-gradient-to-r from-emerald-50 to-white shadow" : "hover:shadow-sm"}`}
                >
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-slate-100 to-white flex items-center justify-center text-slate-800 font-semibold text-sm">
                    {initials(d.name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800">{d.name}</div>
                    <div className="text-xs text-slate-500">{d.specialization || "General"}</div>
                  </div>

                  <div className="text-xs text-gray-400">{/* reserved for future badges */}</div>
                </button>
              ))}
            </div>
          </aside>

          {/* Middle: Slots */}
          <main className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border p-4 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500">Selected</div>
                <div className="text-lg font-semibold text-slate-800">
                  {selectedDoc ? `${selectedDoc.name} — ${selectedDoc.specialization || "General"}` : "No doctor selected"}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => loadSlots(selectedDoc?._id)}
                  className="px-4 py-2 rounded-lg bg-white border hover:bg-gray-50 text-sm"
                >
                  Refresh slots
                </button>
              </div>
            </div>

            {/* Available slots card */}
            <div className="bg-white rounded-2xl border p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">Available slots</h4>
                  <p className="text-xs text-slate-400">Select a time and book instantly</p>
                </div>
                <div className="text-sm text-slate-500">{loadingSlots ? "Loading…" : `${slots.length} available`}</div>
              </div>

              {loadingSlots ? (
                <div className="p-8 text-center text-slate-400">Loading available slots…</div>
              ) : slots.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-sm text-slate-500">No available slots for this doctor right now.</div>
                  <div className="mt-3">
                    <button onClick={() => loadDoctors()} className="px-4 py-2 rounded-md bg-emerald-600 text-white">Check other doctors</button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {slots.map((s) => (
                    <div key={s._id || s.startAt} className="p-3 rounded-xl border hover:shadow-md flex items-center justify-between bg-gradient-to-br from-white to-emerald-50/10">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{fmt(s.startAt)}</div>
                        <div className="text-xs text-slate-500 mt-1">{(s.durationMin || 15) + " min"}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openBookingModal(s)}
                          className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow"
                        >
                          Book
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>

          {/* Right: My Appointments */}
          <aside className="lg:col-span-1 bg-white rounded-2xl border p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">My appointments</h3>
              <button onClick={loadMyAppointments} className="text-xs text-slate-500">Refresh</button>
            </div>

            <div className="space-y-3">
              {loadingAppointments && <div className="text-sm text-slate-500">Loading…</div>}

              {!loadingAppointments && myAppointments.length === 0 && (
                <div className="text-center text-sm text-slate-500 p-6">
                  You have no appointments. Book a slot from the middle panel.
                </div>
              )}

              {myAppointments.map((a) => {
                const status = a.status ? String(a.status) : "Booked";
                const isCancelled = status.toLowerCase() === "cancelled";
                return (
                  <div key={a._id || `${a.doctorId}_${a.startAt}`} className="p-3 border rounded-xl bg-white shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-800">{a.doctorName || a.doctorId || "Doctor"}</div>
                            <div className="text-xs text-slate-500">{fmt(a.startAt)}</div>
                          </div>
                          <div><StatusPill status={status} /></div>
                        </div>

                        <div className="text-xs text-slate-500 mt-2">Reason: <span className="text-slate-700 font-medium">{a.reason || "-"}</span></div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      {!isCancelled && (
                        <button
                          onClick={() => handleCancelAppointment(a)}
                          className="px-3 py-1 rounded-md border text-sm text-rose-600 hover:bg-rose-50"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={() => {
                          alert(`Appointment details\n\nDoctor: ${a.doctorName || a.doctorId}\nStart: ${fmt(a.startAt)}\nDuration: ${a.durationMin || 15} min\nStatus: ${status}\nReason: ${a.reason || "-"}`);
                        }}
                        className="px-3 py-1 rounded-md border text-sm hover:bg-gray-50"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </div>

      {/* BOOKING MODAL — modern with blur */}
      {showBooking && bookingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* backdrop blur + dim */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowBooking(false); setBookingSlot(null); }}></div>

          <div className="relative w-full max-w-md mx-4">
            <div className="bg-white rounded-2xl p-6 shadow-2xl ring-1 ring-slate-100">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Confirm booking</h3>
                  <p className="text-xs text-slate-500 mt-1">{selectedDoc ? `${selectedDoc.name} — ${selectedDoc.specialization || "General"}` : ""}</p>
                  <p className="text-xs text-slate-400 mt-2">Slot — <span className="font-medium text-slate-700">{fmt(bookingSlot.startAt)}</span></p>
                </div>

                <button onClick={() => { setShowBooking(false); setBookingSlot(null); }} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleBook} className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500">Full name</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Your full name"
                    className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="Optional phone number"
                    className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500">Email</label>
                  <input
                    value={form.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="you@example.com"
                    type="email"
                    className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button type="button" onClick={() => { setShowBooking(false); setBookingSlot(null); }} className="px-4 py-2 rounded-md border text-sm">Cancel</button>
                  <button type="submit" className="px-4 py-2 rounded-full bg-emerald-600 text-white text-sm">Confirm booking</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
