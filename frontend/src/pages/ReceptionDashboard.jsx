// src/pages/ReceptionDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../components/AuthProvider";
import useSocket from "../hooks/useSocket";
import { request } from "../utils/api";

/* format date/time */
function fmt(dt) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

export default function ReceptionDashboard() {
  const { user, ready, logout } = useAuth();
  const socketRef = useSocket((ev, payload) => {
    // handle server events and refresh relevant data
    if (!payload) return;
    if (["slot:created", "slot:updated", "appointment:created", "appointment:cancelled", "appointment:updated"].includes(ev)) {
      // if event contains doctorId and it matches selected doctor reload only that
      if (payload.doctorId && selectedDoctor && payload.doctorId === selectedDoctor._id) {
        loadSlots(payload.doctorId);
      } else {
        loadDoctors();
        if (selectedDoctor) loadSlots(selectedDoctor._id);
      }
    }
  });

  // doctors / selection
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  // slots
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // slot creation form
  const [slotStart, setSlotStart] = useState("");
  const [slotDuration, setSlotDuration] = useState(15);
  const [creatingSlot, setCreatingSlot] = useState(false);

  // UI
  const [tab, setTab] = useState("available");
  const [search, setSearch] = useState("");

  // join socket rooms when user ready
  useEffect(() => {
    if (!ready) return;
    // join with role + userId (and doctorId if doctor)
    const socket = socketRef?.current;
    if (socket && user) {
      socket.emit(
        "join",
        {
          userId: String(user._id || user.sub || ""),
          role: user.role,
          doctorId: user.role === "doctor" ? String(user._id || user.sub || "") : undefined,
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, socketRef]);

  useEffect(() => {
    loadDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedDoctor) loadSlots(selectedDoctor._id);
    else setSlots([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctor]);

  async function loadDoctors() {
    setLoadingDoctors(true);
    try {
      const res = await request("/api/doctors");
      setDoctors(res.doctors || []);
      if (!selectedDoctor && res.doctors && res.doctors.length) {
        setSelectedDoctor(res.doctors[0]);
      }
    } catch (err) {
      console.error("Failed to load doctors", err);
      alert(err?.message || "Failed to load doctors");
    } finally {
      setLoadingDoctors(false);
    }
  }

  async function loadSlots(doctorId = selectedDoctor?._id) {
    if (!doctorId) return;
    setLoadingSlots(true);
    try {
      const res = await request(`/api/doctors/${doctorId}/slots`);
      // backend returns { slots: [...] }
      const s = res.slots || [];
      // normalize status to lowercase values used in frontend
      const normalized = s.map((slot) => ({
        ...slot,
        status: (slot.status || "").toString().toLowerCase(),
        // copy nested patient fields to .patient for compatibility
        patient: slot.patient || (slot.appointment ? { name: slot.appointment.patientName, email: slot.appointment.patientEmail } : undefined),
        appointmentId: slot.appointmentId || (slot.appointment && slot.appointment._id) || slot.appointmentId,
      }));
      setSlots(normalized);
    } catch (err) {
      console.error("Failed to load slots", err);
      alert(err?.message || "Failed to load slots");
    } finally {
      setLoadingSlots(false);
    }
  }

  const availableSlots = useMemo(
    () =>
      slots
        .filter((s) => s.status === "available")
        .filter((s) => {
          if (!search.trim()) return true;
          return fmt(s.startAt).toLowerCase().includes(search.toLowerCase());
        })
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt)),
    [slots, search]
  );

  const bookedSlots = useMemo(
    () =>
      slots
        .filter((s) => s.status === "booked")
        .filter((s) => {
          if (!search.trim()) return true;
          const patient = `${s.patient?.name || ""} ${s.patient?.email || ""}`.toLowerCase();
          return patient.includes(search.toLowerCase()) || fmt(s.startAt).toLowerCase().includes(search.toLowerCase());
        })
        .sort((a, b) => new Date(b.startAt) - new Date(a.startAt)),
    [slots, search]
  );

  async function createSlot(e) {
    e?.preventDefault?.();
    if (!selectedDoctor) return alert("Select a doctor first");
    if (!slotStart) return alert("Choose start time");
    setCreatingSlot(true);
    try {
      await request(`/api/doctors/${selectedDoctor._id}/slots`, {
        method: "POST",
        body: JSON.stringify({ startAt: slotStart, durationMin: Number(slotDuration) || 15 }),
      });
      setSlotStart("");
      setSlotDuration(15);
      loadSlots(selectedDoctor._id);
      alert("Slot created");
    } catch (err) {
      console.error("Create slot error", err);
      alert(err?.message || "Failed to create slot");
    } finally {
      setCreatingSlot(false);
    }
  }

  async function bookSlotOnBehalf(slot) {
    const email = prompt("Enter patient email to book this slot (reception):");
    if (!email) return;
    try {
      await request("/api/appointments", {
        method: "POST",
        body: JSON.stringify({ doctorId: selectedDoctor._id, startAt: slot.startAt, durationMin: slot.durationMin || 15, patientEmail: email }),
      });
      loadSlots(selectedDoctor._id);
      alert("Slot booked and patient notified.");
    } catch (err) {
      console.error("Book failed", err);
      alert(err?.message || "Booking failed");
    }
  }

  async function cancelAppointment(slot) {
    if (!slot || !slot.appointmentId) return alert("No appointment associated with this slot");
    if (!confirm("Cancel this appointment? This will notify the patient.")) return;
    try {
      await request(`/api/appointments/${slot.appointmentId}/cancel`, { method: "POST" });
      loadSlots(selectedDoctor._id);
      alert("Appointment cancelled");
    } catch (err) {
      console.error("Cancel failed", err);
      alert(err?.message || "Failed to cancel");
    }
  }

  function StatusBadge({ status }) {
    const s = (status || "").toLowerCase();
    if (s === "available") return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-600 text-white">Available</span>;
    if (s === "booked") return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-500 text-white">Booked</span>;
    if (s === "cancelled") return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500 text-white">Cancelled</span>;
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-700">{s}</span>;
  }

  function SlotRow({ s }) {
    return (
      <div className="w-full flex items-center justify-between gap-4 p-3 hover:bg-gray-50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-slate-800">{fmt(s.startAt)}</div>
            <div className="text-xs text-gray-500">· {s.durationMin || 15} min</div>
            <div><StatusBadge status={s.status} /></div>
          </div>

          {s.status === "booked" && s.patient && (
            <div className="text-xs text-gray-600 mt-1">
              <span className="font-medium text-slate-800">{s.patient.name || "-"}</span>
              <span className="mx-2 text-gray-400">·</span>
              <span className="text-gray-500">{s.patient.email}</span>
            </div>
          )}

          {s.status === "cancelled" && <div className="text-xs text-gray-500 mt-1">Cancelled</div>}
        </div>

        <div className="flex items-center gap-2">
          {s.status === "available" && (
            <button onClick={() => bookSlotOnBehalf(s)} className="px-3 py-1 rounded-md bg-emerald-600 text-white text-sm shadow-sm hover:bg-emerald-700">Book</button>
          )}

          {s.status === "booked" && (
            <>
              <button onClick={() => cancelAppointment(s)} className="px-3 py-1 rounded-md border text-sm text-rose-600 hover:bg-rose-50">Cancel</button>
              <button onClick={() => alert(`Patient: ${s.patient?.name || "N/A"}\nEmail: ${s.patient?.email || "N/A"}\nStart: ${fmt(s.startAt)}`)} className="px-3 py-1 rounded-md border text-sm hover:bg-gray-50">Details</button>
            </>
          )}

          {s.status === "cancelled" && <div className="text-xs text-gray-500 italic">—</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Reception — Slots & Bookings</h2>
            <p className="text-sm text-gray-500">Create slots, book on behalf of patients, and manage appointments.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right mr-3">
              <span className="text-sm font-medium text-slate-800">{user?.name || "Reception"}</span>
              <span className="text-xs text-gray-500">{(user?.role || "").toUpperCase()}</span>
            </div>

            <button onClick={() => { if (selectedDoctor) loadSlots(selectedDoctor._id); else loadDoctors(); }} className="px-3 py-2 rounded-md border bg-white hover:bg-gray-50">Refresh</button>

            <button onClick={() => { try { logout(); } catch(e) { console.error(e); } }} title="Logout" className="px-3 py-2 rounded-md bg-white border hover:bg-gray-50">
              Logout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* doctors */}
          <aside className="lg:col-span-1 bg-white rounded-lg border p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-gray-700">Doctors</h3>
              <div className="flex items-center gap-2">
                <button onClick={loadDoctors} className="text-xs text-slate-500">Reload</button>
              </div>
            </div>

            {loadingDoctors ? (
              <div className="text-sm text-gray-500">Loading doctors…</div>
            ) : (
              <div className="space-y-2">
                {doctors.map((d) => (
                  <button
                    key={d._id}
                    onClick={() => setSelectedDoctor(d)}
                    className={`w-full text-left p-3 rounded-md flex items-center gap-3 hover:bg-gray-50 ${selectedDoctor?._id === d._id ? "ring-2 ring-emerald-200 bg-emerald-50" : ""}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-700">
                      {d.name ? d.name.split(" ").map(p => p[0]).slice(0,2).join("") : "D"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800">{d.name}</div>
                      <div className="text-xs text-gray-500">{d.specialization || "General"}</div>
                    </div>
                    <div className="text-xs text-gray-400">{/* placeholder for badges */}</div>
                  </button>
                ))}
                {doctors.length === 0 && <div className="text-sm text-gray-500">No doctors found</div>}
              </div>
            )}
          </aside>

          {/* slots & actions */}
          <section className="lg:col-span-3 space-y-4">
            <div className="bg-white p-4 rounded-lg border shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="text-sm text-gray-600">Selected</div>
                <div className="text-lg font-semibold text-slate-800">{selectedDoctor ? `${selectedDoctor.name} — ${selectedDoctor.specialization || "General"}` : "No doctor selected"}</div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1">
                  <input
                    placeholder="Search by patient or time..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-md border px-4 py-2 focus:ring-2 focus:ring-emerald-200"
                  />
                  {search && (
                    <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">✕</button>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-gray-100 px-2 py-1 rounded">
                  <button onClick={() => setTab("available")} className={`px-3 py-1 rounded text-sm ${tab === "available" ? "bg-emerald-600 text-white" : "text-slate-700"}`}>Available <span className="ml-2 text-xs text-gray-500">({availableSlots.length})</span></button>
                  <button onClick={() => setTab("booked")} className={`px-3 py-1 rounded text-sm ${tab === "booked" ? "bg-emerald-600 text-white" : "text-slate-700"}`}>Booked <span className="ml-2 text-xs text-gray-500">({bookedSlots.length})</span></button>
                  <button onClick={() => setTab("all")} className={`px-3 py-1 rounded text-sm ${tab === "all" ? "bg-emerald-600 text-white" : "text-slate-700"}`}>All <span className="ml-2 text-xs text-gray-500">({slots.length})</span></button>
                </div>
              </div>
            </div>

            {/* create slot */}
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <form onSubmit={createSlot} className="flex flex-col sm:flex-row gap-3 items-center">
                <input type="datetime-local" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} className="rounded-md border px-4 py-2 flex-1 focus:ring-2 focus:ring-emerald-200" />
                <select value={slotDuration} onChange={(e) => setSlotDuration(e.target.value)} className="rounded-md border px-3 py-2 w-36">
                  <option value={10}>10 min</option>
                  <option value={15}>15 min</option>
                  <option value={20}>20 min</option>
                  <option value={30}>30 min</option>
                </select>
                <div className="flex items-center gap-2 ml-auto">
                  <button type="submit" disabled={creatingSlot} className="px-4 py-2 rounded-md bg-emerald-600 text-white shadow-sm hover:bg-emerald-700">{creatingSlot ? "Creating..." : "Add slot"}</button>
                  <button type="button" onClick={() => { setSlotStart(""); setSlotDuration(15); }} className="px-3 py-2 rounded-md border bg-white">Reset</button>
                </div>
              </form>
              <p className="text-xs text-gray-500 mt-2">Slots created here will be visible to patients for booking. Use the Available tab to book on behalf of patients.</p>
            </div>

            {/* slots list */}
            <div className="bg-white rounded-lg border overflow-hidden shadow-sm">
              {loadingSlots ? (
                <div className="p-6 text-center text-gray-500">Loading slots…</div>
              ) : slots.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="text-sm text-gray-500">No slots for the selected doctor.</div>
                  <div className="mt-3 text-xs text-gray-400">Create a slot using the form above to get started.</div>
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        if (!selectedDoctor) return alert("Select a doctor first");
                        // open datetime-local picker by focusing it
                        const el = document.querySelector('input[type="datetime-local"]');
                        el?.focus?.();
                      }}
                      className="px-4 py-2 rounded-md bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                    >
                      Create first slot
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {tab === "available" && (
                    <div>
                      <div className="p-3 text-sm text-gray-500">Available ({availableSlots.length})</div>
                      <div className="divide-y">{availableSlots.map((s) => <SlotRow key={s._id || s.startAt} s={s} />)}</div>
                    </div>
                  )}
                  {tab === "booked" && (
                    <div>
                      <div className="p-3 text-sm text-gray-500">Booked (most recent first)</div>
                      <div className="divide-y">{bookedSlots.map((s) => <SlotRow key={s._id || s.startAt} s={s} />)}</div>
                    </div>
                  )}
                  {tab === "all" && (
                    <div>
                      <div className="p-3 text-sm text-gray-500">All ({slots.length})</div>
                      <div className="divide-y">{slots.map((s) => <SlotRow key={s._id || s.startAt} s={s} />)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
