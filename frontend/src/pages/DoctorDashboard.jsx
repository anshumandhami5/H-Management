// src/pages/DoctorDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import useSocket from "../hooks/useSocket";
import { useAuth } from "../components/AuthProvider";
import { request } from "../utils/api";

/**
 * DoctorDashboard — improved UI
 * - Today's appointments highlighted at top
 * - Appointments grouped by date with date headers and counts
 * - Search + status filter
 * - Actions: Mark Attended (Completed), Arrived, No-show, Cancel (uses existing endpoints/fallback)
 *
 * Behaviour: only UI changes; API calls unchanged.
 */

function fmt(dt) {
  try { return new Date(dt).toLocaleString(); } catch { return dt; }
}
function dateKey(dt) {
  try {
    const d = new Date(dt);
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  } catch {
    return String(dt);
  }
}
function niceDateLabel(key) {
  // key is YYYY-MM-DD
  try {
    const d = new Date(key + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return key;
  }
}

function StatusBadge({ status }) {
  const s = String(status || "Booked").toLowerCase();
  if (s === "cancelled") return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">Cancelled</span>;
  if (s === "arrived") return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-100">Arrived</span>;
  if (s === "inprogress") return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-100">In progress</span>;
  if (s === "completed") return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">Completed</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-600 text-white">Booked</span>;
}

export default function DoctorDashboard() {
  const { logout } = useAuth();

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // load appointments
  async function load() {
    setLoading(true);
    try {
      const res = await request("/api/appointments");
      const list = (res.appointments || []).slice();
      // ensure stable sort ascending by startAt
      list.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
      setAppointments(list);
    } catch (err) {
      console.error("load appointments:", err);
      alert(err?.message || "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // socket updates — normalized event names
  useSocket((ev, payload) => {
    if (!ev) return;
    const norm = String(ev).replace(/\./g, ":");
    if (["appointment:created", "appointment:cancelled", "appointment:updated", "slot:created", "slot:updated"].includes(norm)) {
      load();
    }
  });

  // change status (tries /status endpoint then falls back to cancel for 'Cancelled')
  async function changeStatus(appt, newStatus) {
    if (!appt) return;
    try {
      await request(`/api/appointments/${appt._id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: newStatus }),
      });
      load();
    } catch (err) {
      // fallback behavior
      if (newStatus === "Cancelled") {
        try {
          await request(`/api/appointments/${appt._id}/cancel`, { method: "POST" });
          load();
        } catch (e) {
          alert(e?.message || "Failed to cancel appointment");
        }
      } else {
        alert(err?.message || "Status change failed (backend may not support /appointments/:id/status).");
      }
    }
  }

  // convenience: mark arrived (sets status to Arrived)
  async function markArrived(appt) {
    if (!appt) return;
    if (!confirm("Mark patient as arrived?")) return;
    changeStatus(appt, "Arrived");
  }

  // group by date (YYYY-MM-DD) after filtering
  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    return appointments.filter((a) => {
      if (filterStatus !== "all") {
        const s = String(a.status || "Booked").toLowerCase();
        if (filterStatus === "booked" && s !== "booked") return false;
        if (filterStatus === "cancelled" && s !== "cancelled") return false;
        if (filterStatus === "completed" && s !== "completed") return false;
      }
      if (!q) return true;
      // search patient name, email, reason
      const patient = `${a.patientName || ""} ${a.patientEmail || ""} ${a.reason || ""} ${a.doctorName || ""}`.toLowerCase();
      return patient.includes(q) || fmt(a.startAt).toLowerCase().includes(q);
    });
  }, [appointments, query, filterStatus]);

  const grouped = useMemo(() => {
    const m = {};
    for (const a of filtered) {
      const k = dateKey(a.startAt);
      if (!m[k]) m[k] = [];
      m[k].push(a);
    }
    // sort keys ascending
    const keys = Object.keys(m).sort((x, y) => new Date(x) - new Date(y));
    return { map: m, keys };
  }, [filtered]);

  // counts for header
  const counts = useMemo(() => {
    const todayKey = dateKey(new Date());
    const todayCount = (grouped.map[todayKey] ? grouped.map[todayKey].length : (grouped.map && grouped.map[todayKey] ? grouped.map[todayKey].length : 0));
    // fallback compute directly
    const today = filtered.filter(a => dateKey(a.startAt) === todayKey).length;
    const upcoming = filtered.filter(a => new Date(a.startAt) > new Date()).length;
    const cancelled = filtered.filter(a => String(a.status || "").toLowerCase() === "cancelled").length;
    return { today, upcoming, cancelled };
  }, [filtered, grouped]);

  // safer counts: compute directly (avoid grouped.map bug)
  const directCounts = useMemo(() => {
    const todayKey = dateKey(new Date());
    return {
      today: filtered.filter(a => dateKey(a.startAt) === todayKey).length,
      upcoming: filtered.filter(a => new Date(a.startAt) > new Date()).length,
      cancelled: filtered.filter(a => String(a.status || "").toLowerCase() === "cancelled").length,
    };
  }, [filtered]);

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Doctor — My Schedule</h1>
            <p className="text-sm text-gray-500">Clear daily view, quick actions and grouped appointments.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex gap-4 text-sm">
              <div className="text-center">
                <div className="text-xs text-gray-500">Today</div>
                <div className="text-lg font-semibold text-slate-800">{directCounts.today}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">Upcoming</div>
                <div className="text-lg font-semibold text-slate-800">{directCounts.upcoming}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">Cancelled</div>
                <div className="text-lg font-semibold text-slate-800">{directCounts.cancelled}</div>
              </div>
            </div>

            <button onClick={load} className="px-3 py-2 rounded-md border bg-white hover:bg-gray-50">Refresh</button>
            <button onClick={logout} className="px-3 py-2 rounded-md bg-white border hover:bg-gray-50">Logout</button>
          </div>
        </div>

        {/* Controls: search + filter */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search patient, email, reason or time..."
              className="w-full sm:w-80 rounded-md border px-3 py-2 focus:ring-2 focus:ring-emerald-200"
            />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-md border px-3 py-2">
              <option value="all">All statuses</option>
              <option value="booked">Booked</option>
              <option value="arrived">Arrived</option>
              <option value="inprogress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="text-sm text-gray-500">
            Showing <span className="font-semibold text-slate-800">{filtered.length}</span> appointments
          </div>
        </div>

        {/* Today's appointments — prominent section */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-800">Today's appointments</h2>
            <div className="text-sm text-gray-500">{new Date().toLocaleDateString()}</div>
          </div>

          <div className="bg-white rounded-lg border p-4">
            {loading && <div className="text-sm text-gray-500">Loading…</div>}

            {!loading && filtered.filter(a => dateKey(a.startAt) === dateKey(new Date())).length === 0 && (
              <div className="p-6 text-center text-sm text-gray-500">No appointments scheduled for today.</div>
            )}

            <div className="space-y-3">
              {filtered
                .filter(a => dateKey(a.startAt) === dateKey(new Date()))
                .sort((a,b) => new Date(a.startAt) - new Date(b.startAt))
                .map(a => (
                <div key={a._id} className="p-3 border rounded flex items-center justify-between gap-4 hover:shadow-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-semibold text-slate-800">{a.patientName || a.patientEmail || "Patient"}</div>
                      <div className="text-xs text-gray-500">{fmt(a.startAt)}</div>
                      <div><StatusBadge status={a.status} /></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Reason: <span className="text-slate-700">{a.reason || "-"}</span></div>
                    <div className="text-xs text-gray-400 mt-1">Booked by: {a.createdBy || "-"}</div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                      <button onClick={() => markArrived(a)} className="px-3 py-1 rounded border text-sm">Arrived</button>
                      <button onClick={() => changeStatus(a, "Completed")} className="px-3 py-1 rounded bg-emerald-600 text-white text-sm">Attended</button>
                      <button onClick={() => changeStatus(a, "NoShow")} className="px-3 py-1 rounded border text-sm">No show</button>
                    </div>
                    <div>
                      <button onClick={() => {
                        if (!confirm("Cancel this appointment?")) return;
                        changeStatus(a, "Cancelled");
                      }} className="px-3 py-1 rounded border text-sm text-rose-600">Cancel</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Grouped appointments by date */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-800">All appointments (by date)</h2>
            <div className="text-sm text-gray-500">Grouped view for quick scanning</div>
          </div>

          {grouped.keys.length === 0 && !loading && (
            <div className="bg-white rounded-lg border p-6 text-center text-sm text-gray-500">No appointments to show.</div>
          )}

          <div className="space-y-6">
            {grouped.keys.map((k) => {
              const list = grouped.map[k] || [];
              return (
                <div key={k}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="px-3 py-1 rounded-lg bg-gradient-to-r from-sky-100 to-emerald-50 text-sm font-semibold text-slate-800">{niceDateLabel(k)}</div>
                      <div className="text-sm text-gray-500">{list.length} appointment{list.length !== 1 ? "s" : ""}</div>
                    </div>
                    <div className="text-sm text-gray-400">{k === dateKey(new Date()) ? "Today" : ""}</div>
                  </div>

                  <div className="bg-white rounded-lg border overflow-hidden">
                    <div className="divide-y">
                      {list.sort((a,b)=> new Date(a.startAt) - new Date(b.startAt)).map((a) => (
                        <div key={a._id} className="p-3 flex items-center justify-between gap-4 hover:bg-gray-50">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <div className="text-sm font-semibold text-slate-800">{a.patientName || a.patientEmail || "Patient"}</div>
                              <div className="text-xs text-gray-500">{fmt(a.startAt)}</div>
                              <div><StatusBadge status={a.status} /></div>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">Reason: <span className="text-slate-700">{a.reason || "-"}</span></div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <div className="flex gap-2">
                              <button onClick={() => markArrived(a)} className="px-3 py-1 rounded border text-sm">Arrived</button>
                              <button onClick={() => changeStatus(a, "Completed")} className="px-3 py-1 rounded bg-emerald-600 text-white text-sm">Attended</button>
                              <button onClick={() => changeStatus(a, "NoShow")} className="px-3 py-1 rounded border text-sm">No show</button>
                            </div>
                            <div>
                              <button onClick={() => {
                                if (!confirm("Cancel this appointment?")) return;
                                changeStatus(a, "Cancelled");
                              }} className="px-3 py-1 rounded border text-sm text-rose-600">Cancel</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
