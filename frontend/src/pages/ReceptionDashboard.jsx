// src/pages/ReceptionDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import useSocket from "../hooks/useSocket";
import { request } from "../utils/api";

/* Small helper to format date/time nicely */
function fmt(dt) {
  try {
    const d = new Date(dt);
    return d.toLocaleString();
  } catch {
    return dt;
  }
}

export default function ReceptionDashboard() {
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  const [slots, setSlots] = useState([]); // all slots for selected doctor
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  // new slot form
  const [slotStart, setSlotStart] = useState("");
  const [slotDuration, setSlotDuration] = useState(15);
  const [creatingSlot, setCreatingSlot] = useState(false);

  // filter/tab state
  const [tab, setTab] = useState("available"); // 'available' | 'booked' | 'all'

  // search
  const [search, setSearch] = useState("");

  // socket listener: reload or selectively reload when relevant events arrive
  useSocket((ev, payload) => {
    // support both colon and dot variants to be tolerant
    const e = String(ev || "").toLowerCase();
    const interesting = [
      "appointment:created",
      "appointment.created",
      "appointment:cancelled",
      "appointment.cancelled",
      "slot:created",
      "slot.created",
      "slot:updated",
      "slot.updated"
    ];
    if (!interesting.includes(e)) return;

    // if payload has doctorId and matches selected doctor -> reload only that doctor
    if (payload?.doctorId) {
      if (selectedDoctor && String(payload.doctorId) === String(selectedDoctor._id)) {
        loadSlots(selectedDoctor._id);
      } else {
        // if change is for some other doctor we don't spam reload; optionally reload list
      }
    } else {
      // generic: reload slots (if doctor selected)
      if (selectedDoctor) loadSlots(selectedDoctor._id);
    }
  });

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
      // pick previously selected doctor if still in list, else pick first
      if (res.doctors && res.doctors.length) {
        setSelectedDoctor((prev) => {
          if (prev && res.doctors.find((d) => String(d._id) === String(prev._id))) return prev;
          return res.doctors[0];
        });
      } else {
        setSelectedDoctor(null);
      }
    } catch (err) {
      console.error("Failed to load doctors", err);
      alert(err.message || "Failed to load doctors");
    } finally {
      setLoadingDoctors(false);
    }
  }

  async function loadSlots(doctorId = selectedDoctor?._id) {
    if (!doctorId) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    try {
      const res = await request(`/api/doctors/${doctorId}/slots`);
      // expect { slots: [...] } or { slots } shape from backend
      setSlots(res.slots || []);
    } catch (err) {
      console.error("Failed to load slots", err);
      alert(err.message || "Failed to load slots");
    } finally {
      setLoadingSlots(false);
    }
  }

  // derived lists
  const availableSlots = useMemo(
    () =>
      slots
        .filter((s) => s.status === "available")
        .filter((s) => {
          if (!search.trim()) return true;
          const q = search.toLowerCase();
          return fmt(s.startAt).toLowerCase().includes(q);
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
          const q = search.toLowerCase();
          const patient = (s.patient?.name || "") + " " + (s.patient?.email || "");
          return (
            patient.toLowerCase().includes(q) ||
            (s.patient?.email || "").toLowerCase().includes(q) ||
            fmt(s.startAt).toLowerCase().includes(q)
          );
        })
        // sort most recent first (descending)
        .sort((a, b) => new Date(b.startAt) - new Date(a.startAt)),
    [slots, search]
  );

  // create slot for selected doctor
  async function createSlot(e) {
    e?.preventDefault?.();
    if (!selectedDoctor) return alert("Select a doctor");
    if (!slotStart) return alert("Choose slot start time");

    setCreatingSlot(true);
    try {
      // ensure ISO string (datetime-local provides local without seconds; keep as-is)
      const payload = { startAt: slotStart, durationMin: Number(slotDuration) || 15 };
      await request(`/api/doctors/${selectedDoctor._id}/slots`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      // refresh and clear
      setSlotStart("");
      setSlotDuration(15);
      loadSlots(selectedDoctor._id);
      alert("Slot created.");
    } catch (err) {
      console.error("Create slot error:", err);
      // show specific guidance on duplicate
      if (err.status === 409) alert(err.message || "Slot already exists for this time");
      else alert(err.message || "Failed to create slot");
    } finally {
      setCreatingSlot(false);
    }
  }

  // receptionist books a slot on behalf of a patient
  async function bookSlotAsReception(s) {
    const email = prompt("Enter patient email to book this slot (reception can book on behalf):");
    if (!email) return;
    const name = prompt("Optional: patient full name (leave blank if unknown):") || undefined;

    try {
      await request("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          doctorId: selectedDoctor._id,
          startAt: s.startAt,
          durationMin: s.durationMin,
          patientEmail: email,
          patientName: name,
        }),
      });
      await loadSlots(selectedDoctor._id);
      alert("Slot booked. Patient will receive confirmation email.");
    } catch (err) {
      console.error("Book slot error:", err);
      if (err.status === 409) alert(err.message || "Slot already booked");
      else if (err.status === 403) alert("You are not allowed to perform this action");
      else alert(err.message || "Failed to book slot");
    }
  }

  // cancel appointment: calls backend endpoint to cancel and backend should send email
  async function cancelAppointment(slot) {
    if (!slot || !slot.appointmentId) return;
    if (!confirm("Cancel this appointment? This will notify the patient by email.")) return;

    try {
      await request(`/appointments/${slot.appointmentId}/cancel`, { method: "POST" });
      // reload slots
      await loadSlots(selectedDoctor._id);
      alert("Appointment cancelled. Patient will be notified by email.");
    } catch (err) {
      console.error("Cancel appointment error:", err);
      if (err.status === 403) alert("You are not allowed to cancel this appointment.");
      else alert(err.message || "Failed to cancel appointment");
    }
  }

  // helper to display slot row actions
  function SlotRow({ s }) {
    return (
      <div className="w-full flex items-center justify-between gap-4 p-3 border-b">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium">{fmt(s.startAt)}</div>
            <div className="text-xs text-gray-500">· {s.durationMin} min</div>
            <div
              className={`ml-2 text-xs px-2 py-1 rounded-full text-white ${
                s.status === "available" ? "bg-emerald-600" : s.status === "booked" ? "bg-teal-500" : "bg-rose-500"
              }`}
            >
              {s.status}
            </div>
          </div>

          {s.status === "booked" && s.patient && (
            <div className="text-xs text-gray-600 mt-1">
              Patient: <span className="font-medium">{s.patient.name || "-"}</span> — <span className="text-gray-500">{s.patient.email}</span>
            </div>
          )}

          {s.status === "cancelled" && <div className="text-xs text-gray-500 mt-1">Cancelled</div>}
        </div>

        <div className="flex items-center gap-2">
          {s.status === "available" && (
            <button onClick={() => bookSlotAsReception(s)} className="px-3 py-1 rounded bg-emerald-600 text-white text-sm">
              Book
            </button>
          )}

          {s.status === "booked" && (
            <>
              <button onClick={() => cancelAppointment(s)} className="px-3 py-1 rounded border text-sm text-rose-600">
                Cancel
              </button>

              <button
                onClick={() => {
                  alert(`Appointment details:\n\nPatient: ${s.patient?.name || "N/A"}\nEmail: ${s.patient?.email || "N/A"}\nStart: ${fmt(s.startAt)}\nDuration: ${s.durationMin} min`);
                }}
                className="px-3 py-1 rounded border text-sm"
              >
                Details
              </button>
            </>
          )}

          {s.status === "cancelled" && <div className="text-xs text-gray-500 italic">—</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Reception — Slots & Bookings</h2>
          <p className="text-sm text-gray-500">Create availability and book slots on behalf of patients.</p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => loadDoctors()} className="px-3 py-1 rounded border">Refresh doctors</button>
          <button onClick={() => loadSlots(selectedDoctor?._id)} className="px-3 py-1 rounded border">Refresh slots</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Doctors list */}
        <aside className="lg:col-span-1 bg-white rounded-lg border p-4">
          <h3 className="font-semibold text-sm text-gray-600 mb-3">Doctors</h3>

          {loadingDoctors ? (
            <div className="text-sm text-gray-500">Loading doctors…</div>
          ) : (
            <div className="space-y-2">
              {doctors.map((d) => (
                <button
                  key={d._id}
                  onClick={() => setSelectedDoctor(d)}
                  className={`w-full text-left p-3 rounded-md hover:bg-gray-50 ${selectedDoctor?._id === d._id ? "ring-2 ring-emerald-200 bg-emerald-50" : ""}`}
                >
                  <div className="font-medium">{d.name}</div>
                  <div className="text-sm text-gray-500">{d.specialization || "General"}</div>
                </button>
              ))}
              {doctors.length === 0 && <div className="text-sm text-gray-500">No doctors found</div>}
            </div>
          )}
        </aside>

        {/* Middle: Slots & actions */}
        <section className="lg:col-span-3 space-y-4">
          <div className="bg-white p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-sm text-gray-600">Selected</div>
              <div className="text-lg font-semibold">
                {selectedDoctor ? `${selectedDoctor.name} — ${selectedDoctor.specialization || "General"}` : "No doctor selected"}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input placeholder="Search by patient/time..." value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-md border px-3 py-2" />

              <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded">
                <button onClick={() => setTab("available")} className={`px-3 py-1 rounded ${tab === "available" ? "bg-emerald-600 text-white" : ""}`}>Available ({availableSlots.length})</button>
                <button onClick={() => setTab("booked")} className={`px-3 py-1 rounded ${tab === "booked" ? "bg-emerald-600 text-white" : ""}`}>Booked ({bookedSlots.length})</button>
                <button onClick={() => setTab("all")} className={`px-3 py-1 rounded ${tab === "all" ? "bg-emerald-600 text-white" : ""}`}>All ({slots.length})</button>
              </div>
            </div>
          </div>

          {/* Create slot form */}
          <div className="bg-white p-4 rounded-lg border">
            <form onSubmit={createSlot} className="flex flex-col sm:flex-row items-stretch gap-2 w-full">
              <input type="datetime-local" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} className="rounded-md border px-3 py-2 flex-1" />
              <select value={slotDuration} onChange={(e) => setSlotDuration(e.target.value)} className="rounded-md border px-3 py-2 w-36">
                <option value={10}>10 min</option>
                <option value={15}>15 min</option>
                <option value={20}>20 min</option>
                <option value={30}>30 min</option>
              </select>

              <div className="flex items-center gap-2">
                <button type="submit" disabled={creatingSlot} className="px-4 py-2 rounded bg-emerald-600 text-white">{creatingSlot ? "Creating..." : "Add slot"}</button>
                <button type="button" onClick={() => { setSlotStart(""); setSlotDuration(15); }} className="px-3 py-2 rounded border">Reset</button>
              </div>
            </form>
            <p className="text-xs text-gray-500 mt-2">Slots will be available to patients for booking. Receptionists can also book a slot directly for a patient from the Available tab.</p>
          </div>

          {/* Slots list */}
          <div className="bg-white rounded-lg border overflow-hidden">
            {loadingSlots ? (
              <div className="p-6 text-center text-gray-500">Loading slots…</div>
            ) : slots.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No slots for selected doctor</div>
            ) : (
              <div>
                {tab === "available" && (
                  <div>
                    <div className="p-3 text-sm text-gray-500">Available slots ({availableSlots.length})</div>
                    <div className="divide-y">
                      {availableSlots.map((s) => <SlotRow key={s._id} s={s} />)}
                    </div>
                  </div>
                )}

                {tab === "booked" && (
                  <div>
                    <div className="p-3 text-sm text-gray-500">Booked slots (most recent first)</div>
                    <div className="divide-y">
                      {bookedSlots.map((s) => <SlotRow key={s._id} s={s} />)}
                    </div>
                  </div>
                )}

                {tab === "all" && (
                  <div>
                    <div className="p-3 text-sm text-gray-500">All slots</div>
                    <div className="divide-y">
                      {slots.map((s) => <SlotRow key={s._id} s={s} />)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
