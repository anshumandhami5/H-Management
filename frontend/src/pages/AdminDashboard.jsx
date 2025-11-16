// src/pages/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { request } from "../utils/api";
import { useAuth } from "../components/AuthProvider";

/**
 * Helper: generate a simple temporary password
 */
function genTempPassword(len = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** Modern Add User Modal */
function AddUserModal({ open, onClose, onAdded }) {
  const [role, setRole] = useState("doctor");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [specialization, setSpec] = useState("");
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState("");

  async function handleAdd(e) {
    e?.preventDefault?.();
    setLoading(true);

    if (!name.trim() || !email.trim()) {
      alert("Name and email are required");
      setLoading(false);
      return;
    }

    const temp = genTempPassword(10);
    setTempPassword(temp);

    try {
      // Include password so backend can email credentials or log them
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        password: temp,
        specialization: role === "doctor" ? specialization.trim() : undefined,
      };

      const res = await request("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // success
      onAdded && onAdded();
      // keep modal open and show the temp password for admin to copy if needed
      alert(res?.message || "User created. Temporary credentials have been emailed (or logged).");
      // reset fields but leave temp password shown briefly
      setName("");
      setEmail("");
      setSpec("");
      setTempPassword(temp);
      // optionally auto-close after short time; here we keep modal open so admin can copy password
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to add user");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Add staff user</h3>
            <button
              onClick={() => {
                setTempPassword("");
                onClose();
              }}
              className="text-gray-500 hover:text-gray-700"
              aria-label="close"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">Create a Doctor or Receptionist account. A temporary password will be generated and emailed.</p>
        </div>

        <form onSubmit={handleAdd} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600 block mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-md border px-3 py-2"
              >
                <option value="doctor">Doctor</option>
                <option value="reception">Receptionist</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-600 block mb-1">Specialization (doctor)</label>
              <input
                value={specializationForRole(role, specialization)}
                onChange={(e) => setSpec(e.target.value)}
                disabled={role !== "doctor"}
                placeholder={role === "doctor" ? "e.g. Cardiology" : "N/A for Reception"}
                className={`w-full rounded-md border px-3 py-2 ${role !== "doctor" ? "bg-gray-50" : ""}`}
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-600 block mb-1">Full name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dr. John Doe"
              className="w-full rounded-md border px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 block mb-1">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@example.com"
              type="email"
              className="w-full rounded-md border px-3 py-2"
            />
          </div>

          {/* show generated temp password after creation */}
          {tempPassword && (
            <div className="rounded-md bg-emerald-50 border border-emerald-100 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-emerald-700 font-medium">Temporary password</div>
                  <div className="mt-1 font-mono text-sm text-emerald-900">{tempPassword}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(tempPassword);
                      alert("Copied to clipboard");
                    }}
                    className="px-3 py-1 rounded bg-emerald-600 text-white text-sm"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTempPassword("");
                      onClose();
                    }}
                    className="px-3 py-1 rounded border text-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setTempPassword("");
                onClose();
              }}
              className="px-4 py-2 rounded border"
            >
              Cancel
            </button>

            {!tempPassword && (
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-60"
              >
                {loading ? "Creating..." : "Create user"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );

  // small utility to avoid controlled/uncontrolled warning for specialization input
  function specializationForRole(r, s) {
    return r === "doctor" ? s : "";
  }
}

/** Admin dashboard main */
export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({ doctors: 0, patients: 0, appointmentsToday: 0 });
  const [open, setOpen] = useState(false);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    try {
      setLoading(true);
      const s = await request("/api/admin/stats");
      setStats(s || { doctors: 0, patients: 0, appointmentsToday: 0 });

      // admin users list endpoint might be /api/admin/users - adapt if different
      const users = await request("/api/admin/users");
      setStaff(users?.users || users || []);
    } catch (e) {
      console.error("Failed to load admin data", e);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // filtered staff
  const filtered = staff.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (s.name || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q) || (s.role || "").toLowerCase().includes(q);
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar role="admin" />

      <div className="flex-1 bg-gray-50">
        {/* Header */}
        <header className="flex items-center justify-between gap-4 p-6 bg-white border-b shadow-sm">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-gray-500">Manage staff, view stats and appointments</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-sm text-gray-700">
                <div className="font-medium">{user?.name}</div>
                <div className="text-xs text-gray-500">{(user?.role || "").toUpperCase()}</div>
              </div>
            </div>

            <button
              onClick={() => setOpen(true)}
              className="px-4 py-2 rounded bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
            >
              + Add user
            </button>

            <button
              onClick={logout}
              className="px-3 py-2 rounded border text-sm"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="p-6">
          {/* Stats */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-lg border">
              <div className="text-sm text-gray-500">Doctors</div>
              <div className="text-3xl font-bold">{stats.doctors}</div>
            </div>

            <div className="p-4 bg-white rounded-lg border">
              <div className="text-sm text-gray-500">Patients</div>
              <div className="text-3xl font-bold">{stats.patients}</div>
            </div>

            <div className="p-4 bg-white rounded-lg border">
              <div className="text-sm text-gray-500">Appointments today</div>
              <div className="text-3xl font-bold">{stats.appointmentsToday}</div>
            </div>
          </section>

          {/* Staff header */}
          <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-lg font-semibold">Staff</h2>

            <div className="flex items-center gap-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, role..."
                className="rounded-md border px-3 py-2 w-64"
              />
              <button onClick={load} className="px-3 py-2 rounded border text-sm">Refresh</button>
            </div>
          </div>

          {/* Staff table */}
          <div className="mt-4 bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Role</th>
                  <th className="p-3 text-left">Specialization</th>
                  <th className="p-3 text-left">Created</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="p-6 text-center text-gray-500">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan="5" className="p-6 text-center text-gray-500">No staff found</td></tr>
                ) : (
                  filtered.map((s) => (
                    <tr key={s._id} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-medium">{s.name}</td>
                      <td className="p-3 text-sm text-gray-600">{s.email}</td>
                      <td className="p-3">{s.role}</td>
                      <td className="p-3">{s.specialization || "-"}</td>
                      <td className="p-3 text-sm text-gray-500">{new Date(s.createdAt || s.created || s.created_at || Date.now()).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>

        <AddUserModal
          open={open}
          onClose={() => {
            setOpen(false);
          }}
          onAdded={() => {
            setOpen(false);
            load();
          }}
        />
      </div>
    </div>
  );
}
