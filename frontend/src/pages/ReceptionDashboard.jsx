// // src/pages/ReceptionDashboard.jsx
// import React, { useEffect, useMemo, useState } from "react";
// import useSocket from "../hooks/useSocket";
// import { request } from "../utils/api";

// /**
//  * Reception dashboard
//  *
//  * Expects backend endpoints:
//  *  GET  /api/doctors
//  *  GET  /api/doctors/:id/slots
//  *  POST /api/doctors/:id/slots      -> { startAt, durationMin }
//  *  POST /api/appointments           -> book appointment
//  *  POST /api/appointments/:id/cancel
//  *
//  * Notes:
//  * - Server emits events like 'slot:created', 'slot:updated', 'appointment:created', 'appointment:cancelled'
//  * - This component listens for both colon and dot variants to be resilient.
//  */

// /* small date formatter */
// function fmt(dt) {
//   try {
//     return new Date(dt).toLocaleString();
//   } catch {
//     return dt;
//   }
// }

// /* normalize slot shape returned from backend to stable fields used by UI */
// function normalizeSlot(raw) {
//   // backend slot fields might be: _id, startAt, durationMin, status, appointmentId, patient
//   // some older shapes might include 'appointment' object etc.
//   const id = raw._id || raw.slotId || raw.id;
//   const startAt = raw.startAt || raw.startAtISO || raw.start;
//   const durationMin = raw.durationMin || raw.duration || 15;
//   // status might be 'Available' vs 'available'
//   const status = (raw.status || raw.state || "available").toString().toLowerCase();
//   const appointmentId = raw.appointmentId || raw.appointment?._id || raw.appointmentId;
//   // patient could be nested or under appointment
//   const patient =
//     raw.patient ||
//     (raw.appointment ? { name: raw.appointment.patientName, email: raw.appointment.patientEmail } : undefined) ||
//     undefined;

//   return {
//     _id: id,
//     startAt,
//     durationMin,
//     status,
//     appointmentId,
//     patient,
//     raw,
//   };
// }

// export default function ReceptionDashboard() {
//   const [doctors, setDoctors] = useState([]);
//   const [selectedDoctor, setSelectedDoctor] = useState(null);

//   const [slots, setSlots] = useState([]); // normalized slots
//   const [loadingSlots, setLoadingSlots] = useState(false);
//   const [loadingDoctors, setLoadingDoctors] = useState(false);

//   // create slot form
//   const [slotStart, setSlotStart] = useState("");
//   const [slotDuration, setSlotDuration] = useState(15);
//   const [creatingSlot, setCreatingSlot] = useState(false);

//   // UI state
//   const [tab, setTab] = useState("available"); // available | booked | all
//   const [search, setSearch] = useState("");

//   // socket -> reload when backend emits relevant events
//   useSocket((ev, payload) => {
//     // accept variants: 'appointment:created' or 'appointment.created', etc
//     const normalized = String(ev || "").replace(/\./g, ":");
//     if (["appointment:created", "appointment:updated", "appointment:cancelled", "slot:created", "slot:updated"].includes(normalized)) {
//       // if payload contains doctorId we can selectively reload slots for that doctor
//       const docId = payload?.doctorId || payload?.appointment?.doctorId || payload?.appointment?.doctor || null;
//       if (!selectedDoctor || !docId) {
//         // reload current doctor's slots (or all doctors if none selected)
//         if (selectedDoctor) loadSlots(selectedDoctor._id);
//         else loadDoctors();
//       } else if (selectedDoctor && String(selectedDoctor._id) === String(docId)) {
//         loadSlots(selectedDoctor._id);
//       } else {
//         // don't force reload for other doctor
//       }
//     }
//   });

//   useEffect(() => {
//     loadDoctors();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   useEffect(() => {
//     if (selectedDoctor) loadSlots(selectedDoctor._id);
//     else setSlots([]);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [selectedDoctor]);

//   async function loadDoctors() {
//     setLoadingDoctors(true);
//     try {
//       const res = await request("/api/doctors");
//       const list = res.doctors || [];
//       setDoctors(list);
//       if (!selectedDoctor && list.length) setSelectedDoctor(list[0]);
//     } catch (err) {
//       console.error("Failed to load doctors", err);
//       alert(err.message || "Failed to load doctors");
//     } finally {
//       setLoadingDoctors(false);
//     }
//   }

//   async function loadSlots(doctorId = selectedDoctor?._id) {
//     if (!doctorId) {
//       setSlots([]);
//       return;
//     }
//     setLoadingSlots(true);
//     try {
//       const res = await request(`/api/doctors/${doctorId}/slots`);
//       const raw = res.slots || [];
//       // normalize each slot
//       const normalized = raw.map(normalizeSlot);
//       // ensure stable sort ascending by startAt
//       normalized.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
//       setSlots(normalized);
//     } catch (err) {
//       console.error("Failed to load slots", err);
//       alert(err.message || "Failed to load slots");
//     } finally {
//       setLoadingSlots(false);
//     }
//   }

//   const availableSlots = useMemo(() => {
//     const q = (search || "").trim().toLowerCase();
//     return slots
//       .filter((s) => s.status === "available")
//       .filter((s) => {
//         if (!q) return true;
//         return fmt(s.startAt).toLowerCase().includes(q);
//       })
//       .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
//   }, [slots, search]);

//   const bookedSlots = useMemo(() => {
//     const q = (search || "").trim().toLowerCase();
//     return slots
//       .filter((s) => s.status === "booked")
//       .filter((s) => {
//         if (!q) return true;
//         const patient = `${s.patient?.name || ""} ${s.patient?.email || ""}`;
//         return patient.toLowerCase().includes(q) || fmt(s.startAt).toLowerCase().includes(q);
//       })
//       .sort((a, b) => new Date(b.startAt) - new Date(a.startAt)); // recent first
//   }, [slots, search]);

//   // create a new slot
//   async function createSlot(e) {
//     e?.preventDefault?.();
//     if (!selectedDoctor) return alert("Select a doctor first");
//     if (!slotStart) return alert("Choose a start time");

//     setCreatingSlot(true);
//     try {
//       const payload = { startAt: slotStart, durationMin: Number(slotDuration) || 15 };
//       await request(`/api/doctors/${selectedDoctor._id}/slots`, {
//         method: "POST",
//         body: JSON.stringify(payload),
//       });
//       setSlotStart("");
//       setSlotDuration(15);
//       loadSlots(selectedDoctor._id);
//     } catch (err) {
//       console.error("Create slot failed:", err);
//       if (err.status === 409) {
//         alert("A slot already exists for this start time.");
//       } else if (err.status === 403) {
//         alert("Forbidden — you may not have permission to create slots.");
//       } else {
//         alert(err.message || "Failed to create slot");
//       }
//     } finally {
//       setCreatingSlot(false);
//     }
//   }

//   // receptionist books a slot on behalf of a patient
//   async function bookSlotByReception(slot) {
//     const email = prompt("Enter patient email to book this slot (reception can book on behalf):");
//     if (!email) return;
//     try {
//       await request("/api/appointments", {
//         method: "POST",
//         body: JSON.stringify({
//           doctorId: selectedDoctor._id,
//           startAt: slot.startAt,
//           durationMin: slot.durationMin,
//           patientEmail: email,
//         }),
//       });
//       // reload slots and notify
//       await loadSlots(selectedDoctor._id);
//       alert("Slot booked — patient will receive an email.");
//     } catch (err) {
//       console.error("Book failed:", err);
//       if (err.status === 409) alert("Slot already booked.");
//       else alert(err.message || "Failed to book slot");
//     }
//   }

//   // cancel appointment
//   async function cancelAppointment(slot) {
//     const apptId = slot.appointmentId || slot.raw?.appointment?._id;
//     if (!apptId) return alert("No appointment found for this slot");
//     if (!confirm("Cancel this appointment? Patient will be notified by email.")) return;
//     try {
//       await request(`/api/appointments/${apptId}/cancel`, { method: "POST", body: JSON.stringify({ reason: "Cancelled by reception" }) });
//       await loadSlots(selectedDoctor._id);
//       alert("Appointment cancelled and patient notified.");
//     } catch (err) {
//       console.error("Cancel failed:", err);
//       alert(err.message || "Failed to cancel appointment");
//     }
//   }

//   function SlotRow({ s }) {
//     return (
//       <div className="w-full flex items-center justify-between gap-4 p-3 border-b">
//         <div className="flex-1 min-w-0">
//           <div className="flex items-center gap-3">
//             <div className="text-sm font-medium">{fmt(s.startAt)}</div>
//             <div className="text-xs text-gray-500">· {s.durationMin} min</div>
//             <div
//               className={`ml-2 text-xs px-2 py-1 rounded-full text-white ${s.status === "available" ? "bg-emerald-600" : s.status === "booked" ? "bg-teal-500" : "bg-rose-500"}`}
//             >
//               {s.status}
//             </div>
//           </div>
//           {s.status === "booked" && s.patient && (
//             <div className="text-xs text-gray-600 mt-1">
//               Patient: <span className="font-medium">{s.patient.name || "-"}</span> — <span className="text-gray-500">{s.patient.email}</span>
//             </div>
//           )}
//           {s.status === "cancelled" && <div className="text-xs text-gray-500 mt-1">Cancelled</div>}
//         </div>

//         <div className="flex items-center gap-2">
//           {s.status === "available" && (
//             <button onClick={() => bookSlotByReception(s)} className="px-3 py-1 rounded bg-emerald-600 text-white text-sm">
//               Book
//             </button>
//           )}

//           {s.status === "booked" && (
//             <>
//               <button onClick={() => cancelAppointment(s)} className="px-3 py-1 rounded border text-sm text-rose-600">
//                 Cancel
//               </button>

//               <button
//                 onClick={() => {
//                   alert(`Appointment details:\n\nPatient: ${s.patient?.name || "N/A"}\nEmail: ${s.patient?.email || "N/A"}\nStart: ${fmt(s.startAt)}\nDuration: ${s.durationMin} min`);
//                 }}
//                 className="px-3 py-1 rounded border text-sm"
//               >
//                 Details
//               </button>
//             </>
//           )}

//           {s.status === "cancelled" && <div className="text-xs text-gray-500 italic">—</div>}
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="p-6 space-y-6">
//       <div className="flex items-center justify-between">
//         <h2 className="text-2xl font-bold">Reception — Slots & Bookings</h2>
//         <div className="flex items-center gap-3">
//           <button onClick={() => (selectedDoctor ? loadSlots(selectedDoctor._id) : loadDoctors())} className="px-3 py-1 rounded border">
//             Refresh
//           </button>
//         </div>
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
//         {/* LEFT: doctors */}
//         <aside className="lg:col-span-1 bg-white rounded-lg border p-4">
//           <h3 className="font-semibold text-sm text-gray-600 mb-3">Doctors</h3>

//           {loadingDoctors ? (
//             <div className="text-sm text-gray-500">Loading doctors…</div>
//           ) : (
//             <div className="space-y-2">
//               {doctors.map((d) => (
//                 <button
//                   key={d._id}
//                   onClick={() => setSelectedDoctor(d)}
//                   className={`w-full text-left p-3 rounded-md hover:bg-gray-50 ${selectedDoctor?._id === d._id ? "ring-2 ring-emerald-200 bg-emerald-50" : ""}`}
//                 >
//                   <div className="font-medium">{d.name}</div>
//                   <div className="text-sm text-gray-500">{d.specialization || "General"}</div>
//                 </button>
//               ))}
//               {doctors.length === 0 && <div className="text-sm text-gray-500">No doctors found</div>}
//             </div>
//           )}
//         </aside>

//         {/* MIDDLE: slots */}
//         <section className="lg:col-span-3 space-y-4">
//           <div className="bg-white p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
//             <div>
//               <div className="text-sm text-gray-600">Selected</div>
//               <div className="text-lg font-semibold">{selectedDoctor ? `${selectedDoctor.name} — ${selectedDoctor.specialization || "General"}` : "No doctor selected"}</div>
//             </div>

//             <div className="flex items-center gap-3">
//               <input placeholder="Search by patient/time..." value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-md border px-3 py-2" />

//               <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded">
//                 <button onClick={() => setTab("available")} className={`px-3 py-1 rounded ${tab === "available" ? "bg-emerald-600 text-white" : ""}`}>
//                   Available ({availableSlots.length})
//                 </button>
//                 <button onClick={() => setTab("booked")} className={`px-3 py-1 rounded ${tab === "booked" ? "bg-emerald-600 text-white" : ""}`}>
//                   Booked ({bookedSlots.length})
//                 </button>
//                 <button onClick={() => setTab("all")} className={`px-3 py-1 rounded ${tab === "all" ? "bg-emerald-600 text-white" : ""}`}>
//                   All ({slots.length})
//                 </button>
//               </div>
//             </div>
//           </div>

//           {/* create slot form */}
//           <div className="bg-white p-4 rounded-lg border">
//             <form onSubmit={createSlot} className="flex flex-col sm:flex-row gap-2 items-stretch">
//               <input type="datetime-local" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} className="rounded-md border px-3 py-2 flex-1" />
//               <select value={slotDuration} onChange={(e) => setSlotDuration(e.target.value)} className="rounded-md border px-3 py-2 w-36">
//                 <option value={10}>10 min</option>
//                 <option value={15}>15 min</option>
//                 <option value={20}>20 min</option>
//                 <option value={30}>30 min</option>
//               </select>
//               <div className="flex items-center gap-2">
//                 <button type="submit" disabled={creatingSlot} className="px-4 py-2 rounded bg-emerald-600 text-white">
//                   {creatingSlot ? "Creating..." : "Add slot"}
//                 </button>
//                 <button type="button" onClick={() => { setSlotStart(""); setSlotDuration(15); }} className="px-3 py-2 rounded border">
//                   Reset
//                 </button>
//               </div>
//             </form>
//             <p className="text-xs text-gray-500 mt-2">Slots will be available to patients for booking. Receptionists can book a slot directly from the Available tab.</p>
//           </div>

//           {/* slots list */}
//           <div className="bg-white rounded-lg border overflow-hidden">
//             {loadingSlots ? (
//               <div className="p-6 text-center text-gray-500">Loading slots…</div>
//             ) : slots.length === 0 ? (
//               <div className="p-6 text-center text-gray-500">No slots for selected doctor</div>
//             ) : (
//               <div>
//                 {tab === "available" && (
//                   <div>
//                     <div className="p-3 text-sm text-gray-500">Available slots ({availableSlots.length})</div>
//                     <div className="divide-y">{availableSlots.map((s) => <SlotRow key={s._id || s.startAt} s={s} />)}</div>
//                   </div>
//                 )}

//                 {tab === "booked" && (
//                   <div>
//                     <div className="p-3 text-sm text-gray-500">Booked slots (most recent first)</div>
//                     <div className="divide-y">{bookedSlots.map((s) => <SlotRow key={s._id || s.startAt} s={s} />)}</div>
//                   </div>
//                 )}

//                 {tab === "all" && (
//                   <div>
//                     <div className="p-3 text-sm text-gray-500">All slots</div>
//                     <div className="divide-y">{slots.map((s) => <SlotRow key={s._id || s.startAt} s={s} />)}</div>
//                   </div>
//                 )}
//               </div>
//             )}
//           </div>
//         </section>
//       </div>
//     </div>
//   );
// }



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
  const { user, ready } = useAuth();
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
      socket.emit("join", { userId: String(user._id || user.sub || ""), role: user.role, doctorId: user.role === "doctor" ? String(user._id || user.sub || "") : undefined });
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

  function SlotRow({ s }) {
    return (
      <div className="w-full flex items-center justify-between gap-4 p-3 border-b">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium">{fmt(s.startAt)}</div>
            <div className="text-xs text-gray-500">· {s.durationMin || 15} min</div>
            <div className={`ml-2 text-xs px-2 py-1 rounded-full text-white ${s.status === "available" ? "bg-emerald-600" : s.status === "booked" ? "bg-sky-500" : "bg-rose-500"}`}>
              {s.status}
            </div>
          </div>

          {s.status === "booked" && s.patient && (
            <div className="text-xs text-gray-600 mt-1">Patient: <span className="font-medium">{s.patient.name || "-"}</span> — <span className="text-gray-500">{s.patient.email}</span></div>
          )}
          {s.status === "cancelled" && <div className="text-xs text-gray-500 mt-1">Cancelled</div>}
        </div>

        <div className="flex items-center gap-2">
          {s.status === "available" && (
            <button onClick={() => bookSlotOnBehalf(s)} className="px-3 py-1 rounded bg-emerald-600 text-white text-sm">Book</button>
          )}

          {s.status === "booked" && (
            <>
              <button onClick={() => cancelAppointment(s)} className="px-3 py-1 rounded border text-sm text-rose-600">Cancel</button>
              <button onClick={() => alert(`Patient: ${s.patient?.name || "N/A"}\nEmail: ${s.patient?.email || "N/A"}\nStart: ${fmt(s.startAt)}`)} className="px-3 py-1 rounded border text-sm">Details</button>
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
        <h2 className="text-2xl font-bold">Reception — Slots & Bookings</h2>
        <div className="flex items-center gap-3">
          <button onClick={() => { if (selectedDoctor) loadSlots(selectedDoctor._id); else loadDoctors(); }} className="px-3 py-1 rounded border">Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* doctors */}
        <aside className="lg:col-span-1 bg-white rounded-lg border p-4">
          <h3 className="font-semibold text-sm text-gray-600 mb-3">Doctors</h3>
          {loadingDoctors ? (
            <div className="text-sm text-gray-500">Loading doctors…</div>
          ) : (
            <div className="space-y-2">
              {doctors.map((d) => (
                <button key={d._id} onClick={() => setSelectedDoctor(d)} className={`w-full text-left p-3 rounded-md hover:bg-gray-50 ${selectedDoctor?._id === d._id ? "ring-2 ring-emerald-200 bg-emerald-50" : ""}`}>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-sm text-gray-500">{d.specialization || "General"}</div>
                </button>
              ))}
              {doctors.length === 0 && <div className="text-sm text-gray-500">No doctors found</div>}
            </div>
          )}
        </aside>

        {/* slots & actions */}
        <section className="lg:col-span-3 space-y-4">
          <div className="bg-white p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-sm text-gray-600">Selected</div>
              <div className="text-lg font-semibold">{selectedDoctor ? `${selectedDoctor.name} — ${selectedDoctor.specialization || "General"}` : "No doctor selected"}</div>
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

          {/* create slot */}
          <div className="bg-white p-4 rounded-lg border">
            <form onSubmit={createSlot} className="flex gap-2 flex-col sm:flex-row items-center">
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
            <p className="text-xs text-gray-500 mt-2">Slots created here will be visible to patients for booking. Receptionists can book on behalf of patients from the Available tab.</p>
          </div>

          {/* slots list */}
          <div className="bg-white rounded-lg border overflow-hidden">
            {loadingSlots ? (
              <div className="p-6 text-center text-gray-500">Loading slots…</div>
            ) : slots.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No slots for selected doctor</div>
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
  );
}
