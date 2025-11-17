// src/pages/DoctorDashboard.jsx
import React, { useEffect, useState } from "react";
import useSocket from "../hooks/useSocket";
import { useAuth } from "../components/AuthProvider";
import { request } from "../utils/api";

/**
 * DoctorDashboard
 * - Shows doctor's appointments (server should filter by token/role)
 * - Actions: Mark Attended (Completed), No-show, Cancel by doctor
 * - Logout button included
 *
 * Notes:
 * - Uses GET /api/appointments (server will filter by req.user.role==='doctor')
 * - Cancelling uses POST /api/appointments/:id/cancel
 * - Status change uses POST /api/appointments/:id/status  (backend must implement; otherwise this call may fail — we still provide it)
 */

function fmt(dt) {
  try { return new Date(dt).toLocaleString(); } catch { return dt; }
}

export default function DoctorDashboard() {
  const { logout } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  useSocket((ev, payload) => {
    if (!ev) return;
    if (["appointment:created", "appointment:cancelled", "slot:created", "slot:updated"].includes(ev)) {
      load();
    }
  });

  async function load() {
    setLoading(true);
    try {
      const res = await request("/api/appointments");
      setAppointments((res.appointments || []).sort((a,b) => new Date(a.startAt) - new Date(b.startAt)));
    } catch (err) {
      console.error("load appointments:", err);
      alert(err.message || "Failed to load appointments");
    } finally { setLoading(false); }
  }

  async function changeStatus(appt, newStatus) {
    if (!appt) return;
    try {
      // try status endpoint first (backend may support /appointments/:id/status)
      await request(`/api/appointments/${appt._id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: newStatus })
      });
      load();
    } catch (err) {
      // fallback: use cancel endpoint for cancel; otherwise inform user backend needs implementation
      if (newStatus === "Cancelled") {
        try {
          await request(`/api/appointments/${appt._id}/cancel`, { method: "POST" });
          load();
        } catch (e) {
          alert(e.message || "Failed to cancel appointment");
        }
      } else {
        alert(err.message || "Status change failed (backend may not support /appointments/:id/status).");
      }
    }
  }

  return (
    <div className="min-h-screen p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Doctor — My bookings</h1>
          <p className="text-sm text-gray-500">View today's and upcoming appointments</p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={logout} className="px-3 py-2 rounded border">Logout</button>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Appointments</h2>
          <button onClick={load} className="px-3 py-1 rounded border text-sm">Refresh</button>
        </div>

        {loading && <div className="text-sm text-gray-500">Loading…</div>}
        {!loading && appointments.length === 0 && <div className="text-sm text-gray-500">No appointments</div>}

        <div className="space-y-3">
          {appointments.map(a => (
            <div key={a._id} className="p-3 border rounded flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <div className="font-medium">{a.patientName || a.patientEmail || 'Patient'}</div>
                  <div className="text-sm text-gray-500">{fmt(a.startAt)}</div>
                  <div className="ml-2 text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">{a.status || 'Booked'}</div>
                </div>
                <div className="text-sm text-gray-600 mt-1">Reason: {a.reason || '-'}</div>
                <div className="text-xs text-gray-500 mt-1">Booked by: {a.createdBy || '-'}</div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-2">
                  <button onClick={() => changeStatus(a, 'Completed')} className="px-3 py-1 rounded bg-emerald-600 text-white text-sm">Attended</button>
                  <button onClick={() => changeStatus(a, 'NoShow')} className="px-3 py-1 rounded border text-sm">No show</button>
                </div>

                <div>
                  <button onClick={() => {
                    if (!confirm("Cancel this appointment?")) return;
                    changeStatus(a, 'Cancelled');
                  }} className="px-3 py-1 rounded border text-sm text-rose-600">Cancel</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
