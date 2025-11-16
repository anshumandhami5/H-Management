// src/pages/DoctorDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import useSocket from "../hooks/useSocket";
import { request } from "../utils/api";
import { useAuth } from "../components/AuthProvider";

/**
 * Doctor dashboard:
 * - detects logged-in doctor from useAuth()
 * - fetches /api/appointments (backend should filter by doctor role)
 * - shows filters (Today / Upcoming / All), search, and actions
 */

function fmt(dt) {
  try {
    const d = new Date(dt);
    return d.toLocaleString();
  } catch {
    return dt;
  }
}

function statusBadge(status) {
  const map = {
    Booked: "bg-emerald-600",
    Arrived: "bg-indigo-600",
    InProgress: "bg-yellow-500 text-black",
    Completed: "bg-slate-400",
    Cancelled: "bg-rose-500",
    NoShow: "bg-rose-600",
  };
  const cls = map[status] || "bg-gray-400";
  return (
    <span className={`${cls} text-white text-xs font-semibold px-2 py-0.5 rounded-full`}>
      {status}
    </span>
  );
}

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("today"); // today | upcoming | all
  const [search, setSearch] = useState("");
  const [busyIds, setBusyIds] = useState(new Set());

  // load appointments (backend will filter by doctor if token is doctor)
  async function load() {
    setLoading(true);
    try {
      const res = await request("/api/appointments");
      setAppointments(res.appointments || []);
    } catch (err) {
      console.error("Failed to load appointments", err);
      alert(err.message || "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // socket: reload on relevant events. accept colon & dot variants to be robust.
  useSocket((ev, payload) => {
    const e = String(ev || "").toLowerCase();
    const interesting = [
      "appointment:created",
      "appointment.created",
      "appointment:updated",
      "appointment.updated",
      "appointment:cancelled",
      "appointment.cancelled",
    ];
    if (interesting.includes(e)) {
      // If payload has doctor id and it matches logged in user (or backend uses doctor field), refresh
      if (!payload?.appointment?.doctor && payload?.doctorId) {
        if (String(payload.doctorId) === String(user?._id)) load();
      } else if (payload?.appointment?.doctor) {
        if (String(payload.appointment.doctor) === String(user?._id)) load();
      } else {
        load();
      }
    }
  });

  // computed lists
  const todayDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const tomorrowDate = useMemo(() => {
    const d = new Date(todayDate);
    d.setDate(d.getDate() + 1);
    return d;
  }, [todayDate]);

  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    return (appointments || [])
      .filter((a) => {
        // filter by "today"/"upcoming"
        if (filter === "today") {
          const s = new Date(a.startAt);
          return s >= todayDate && s < tomorrowDate;
        } else if (filter === "upcoming") {
          const s = new Date(a.startAt);
          return s >= tomorrowDate;
        }
        return true;
      })
      .filter((a) => {
        if (!q) return true;
        const patient = `${a.patientName || ""} ${a.patientEmail || ""}`.toLowerCase();
        const start = fmt(a.startAt).toLowerCase();
        return patient.includes(q) || start.includes(q) || (a.reason || "").toLowerCase().includes(q);
      })
      .sort((x, y) => new Date(x.startAt) - new Date(y.startAt));
  }, [appointments, filter, search, todayDate, tomorrowDate]);

  // change appointment status endpoint (expects POST /appointments/:id/status { status })
  async function changeStatus(apptId, status) {
    if (!apptId) return;
    setBusyIds((s) => new Set(s).add(apptId));
    try {
      await request(`/appointments/${apptId}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (err) {
      console.error("Status change failed", err);
      alert(err.message || "Failed to change status");
    } finally {
      setBusyIds((prev) => {
        const n = new Set(prev);
        n.delete(apptId);
        return n;
      });
    }
  }

  // small appointment card inline (keeps dependency on AppointmentCard optional)
  function AppointmentRow({ a }) {
    const busy = busyIds.has(a._id);
    return (
      <div className="bg-white border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <div className="w-14 text-sm text-gray-700">
              <div className="text-xs text-gray-400">Start</div>
              <div className="font-medium">{fmt(a.startAt)}</div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-md font-semibold truncate">{a.patientName || a.patientEmail || "Unknown patient"}</div>
                {statusBadge(a.status)}
              </div>
              <div className="text-sm text-gray-500 mt-1 truncate">{a.reason || "— No reason provided —"}</div>

              <div className="mt-2 text-sm text-gray-600">
                Duration: <span className="font-medium">{a.durationMin || 15} min</span> · Email: <span className="font-medium">{a.patientEmail}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-2">
          {/* actions depending on current status */}
          {a.status === "Booked" && (
            <>
              <button
                onClick={() => changeStatus(a._id, "Arrived")}
                disabled={busy}
                className="px-3 py-1 rounded bg-indigo-600 text-white text-sm"
              >
                Mark Arrived
              </button>

              <button
                onClick={() => changeStatus(a._id, "InProgress")}
                disabled={busy}
                className="px-3 py-1 rounded bg-yellow-400 text-black text-sm"
              >
                Start
              </button>
            </>
          )}

          {a.status === "Arrived" && (
            <>
              <button
                onClick={() => changeStatus(a._id, "InProgress")}
                disabled={busy}
                className="px-3 py-1 rounded bg-yellow-400 text-black text-sm"
              >
                Start
              </button>
            </>
          )}

          {a.status === "InProgress" && (
            <>
              <button
                onClick={() => changeStatus(a._id, "Completed")}
                disabled={busy}
                className="px-3 py-1 rounded bg-emerald-600 text-white text-sm"
              >
                Complete
              </button>

              <button
                onClick={() => {
                  if (!confirm("Mark as no-show?")) return;
                  changeStatus(a._id, "NoShow");
                }}
                disabled={busy}
                className="px-3 py-1 rounded border text-sm text-rose-600"
              >
                No-Show
              </button>
            </>
          )}

          {/* Always allow cancellation if permitted by backend (here we call same status endpoint) */}
          {a.status !== "Cancelled" && a.status !== "Completed" && (
            <button
              onClick={() => {
                if (!confirm("Cancel appointment? This will notify the patient.")) return;
                changeStatus(a._id, "Cancelled");
              }}
              disabled={busy}
              className="px-3 py-1 rounded border text-sm text-rose-600"
            >
              Cancel
            </button>
          )}

          <button
            onClick={() => {
              // quick details modal replacement
              alert(
                `Appointment details:\n\nPatient: ${a.patientName || "N/A"}\nEmail: ${a.patientEmail || "N/A"}\nStart: ${fmt(
                  a.startAt
                )}\nDuration: ${a.durationMin || 15} min\nStatus: ${a.status}\nReason: ${a.reason || "-"}`
              );
            }}
            className="px-3 py-1 rounded border text-sm"
          >
            Details
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Doctor Dashboard</h1>
          <div className="text-sm text-gray-600">Welcome{user?.name ? `, Dr. ${user.name}` : ""} — view and manage your appointments.</div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500">Role: <span className="font-medium">{user?.role}</span></div>
        </div>
      </header>

      <div className="bg-white p-4 rounded-lg border flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setFilter("today")} className={`px-3 py-1 rounded ${filter === "today" ? "bg-emerald-600 text-white" : "border"}`}>Today</button>
          <button onClick={() => setFilter("upcoming")} className={`px-3 py-1 rounded ${filter === "upcoming" ? "bg-emerald-600 text-white" : "border"}`}>Upcoming</button>
          <button onClick={() => setFilter("all")} className={`px-3 py-1 rounded ${filter === "all" ? "bg-emerald-600 text-white" : "border"}`}>All</button>
        </div>

        <div className="flex items-center gap-3">
          <input
            placeholder="Search patient / time / reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md border px-3 py-2"
          />
          <button onClick={() => load()} className="px-3 py-1 rounded border">Refresh</button>
        </div>
      </div>

      <section className="space-y-3">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading appointments…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No appointments found for selected filter.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((a) => (
              <AppointmentRow key={a._id} a={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
