// src/pages/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { request } from "../utils/api"; // named export 'request' now available

function AddUserModal({ open, onClose, onAdded }) {
  const [role, setRole] = useState("doctor");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [specialization, setSpec] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { name, email, role, specialization: role === 'doctor' ? specialization : undefined };
      // call backend admin signup endpoint
      const res = await request("/api/auth/signup", { method: "POST", body: JSON.stringify(payload) });
      // res: { message, user }
      onAdded && onAdded();
      setName(""); setEmail(""); setSpec("");
      onClose();
      alert(res.message || "User added. Temporary credentials emailed (or logged).");
    } catch (err) {
      alert(err.message || "Failed to add");
    } finally { setLoading(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Add user (Doctor / Receptionist)</h3>
        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label className="text-sm text-gray-600">Role</label>
            <select value={role} onChange={e=>setRole(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2">
              <option value="doctor">Doctor</option>
              <option value="reception">Receptionist</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-600">Full name</label>
            <input value={name} onChange={e=>setName(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" />
          </div>

          <div>
            <label className="text-sm text-gray-600">Email</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} type="email" className="mt-1 block w-full rounded border px-3 py-2" />
          </div>

          {role === "doctor" && (
            <div>
              <label className="text-sm text-gray-600">Specialization</label>
              <input value={specialization} onChange={e=>setSpec(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2" />
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded border">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded bg-emerald-600 text-white">{loading ? 'Adding...' : 'Add user'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({ doctors:0, patients:0, appointmentsToday:0 });
  const [open, setOpen] = useState(false);
  const [staff, setStaff] = useState([]);

  async function load() {
    try {
      const s = await request("/api/admin/stats");
      setStats(s);
      const users = await request("/api/admin/users");
      setStaff(users.users || []);
    } catch (e) {
      console.error(e);
    }
  }
  useEffect(()=>{ load(); }, []);

  return (
    <div className="flex">
      <Sidebar role="admin" />
      <div className="flex-1 min-h-screen bg-gray-50">
        <Topbar title="Admin Dashboard" />
        <main className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Doctors</div>
              <div className="text-2xl font-bold">{stats.doctors}</div>
            </div>
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Patients</div>
              <div className="text-2xl font-bold">{stats.patients}</div>
            </div>
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Appointments today</div>
              <div className="text-2xl font-bold">{stats.appointmentsToday}</div>
            </div>
          </div>

          <div className="mt-6 flex justify-between items-center">
            <h2 className="text-lg font-semibold">Staff</h2>
            <div>
              <button onClick={()=>setOpen(true)} className="px-4 py-2 bg-emerald-600 text-white rounded">Add user</button>
            </div>
          </div>

          <div className="mt-4 bg-white rounded shadow overflow-auto">
            <table className="w-full table-auto">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Role</th>
                  <th className="p-3 text-left">Specialization</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(s => (
                  <tr key={s._id} className="border-t">
                    <td className="p-3">{s.name}</td>
                    <td className="p-3 text-sm text-gray-600">{s.email}</td>
                    <td className="p-3">{s.role}</td>
                    <td className="p-3">{s.specialization || '-'}</td>
                  </tr>
                ))}
                {staff.length===0 && <tr><td className="p-4" colSpan="4">No staff yet</td></tr>}
              </tbody>
            </table>
          </div>
        </main>

        <AddUserModal open={open} onClose={()=>setOpen(false)} onAdded={load} />
      </div>
    </div>
  );
}
