// src/App.jsx
import React from "react";
import { Routes, Route, Navigate, Link } from "react-router-dom";

import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import PatientDashboard from "./pages/PatientDashboard";
import ReceptionDashboard from "./pages/ReceptionDashboard";
import PatientBooking from "./pages/PatientBooking";
import VerifyEmail from "./pages/VerifyEmail";
import ChangePassword from "./pages/ChangePassword";

import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./components/AuthProvider";

/**
 * Home component:
 * - If logged in, redirects user to their role dashboard
 * - If not logged in, redirects to /login
 */
function Home() {
  const { user, ready } = useAuth();

  // wait for auth initialization
  if (!ready) return null;

  if (!user) return <Navigate to="/login" replace />;

  // route by role
  const role = user.role;
  if (role === "admin") return <Navigate to="/admin" replace />;
  if (role === "doctor") return <Navigate to="/doctor" replace />;
  if (role === "reception") return <Navigate to="/reception" replace />;
  if (role === "patient") return <Navigate to="/patient" replace />;

  // fallback
  return <Navigate to="/login" replace />;
}

/** Small topbar component (shows login/logout when available) */
function Topbar() {
  const { user, logout, ready } = useAuth();

  if (!ready) return null;

  return (
    <div className="topbar flex items-center justify-between p-4 bg-white shadow-sm">
      <div>
        <h1 className="text-xl font-bold">Hospital Management System</h1>
        <p className="text-sm text-gray-500">Single login portal · role-based dashboards</p>
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <>
            <div className="text-sm text-gray-700">
              <span className="font-medium mr-2">{user.name}</span>
              <span className="px-2 py-1 rounded bg-gray-100 text-xs">{(user.role || "").toUpperCase()}</span>
            </div>
            <button onClick={logout} className="px-3 py-1 rounded border">Logout</button>
          </>
        ) : (
          <Link to="/login" className="px-3 py-1 rounded bg-emerald-600 text-white">Login</Link>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const { ready } = useAuth();

  // don't render until auth is ready to avoid UI flash
  if (!ready) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Topbar />

      <main className="max-w-7xl mx-auto p-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* Patient booking (protected) */}
          <Route element={<ProtectedRoute allowedRoles={["patient"]} />}>
            <Route path="/book" element={<PatientBooking />} />
          </Route>

          {/* Protected routes by role */}
          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["doctor"]} />}>
            <Route path="/doctor" element={<DoctorDashboard />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["patient"]} />}>
            <Route path="/patient" element={<PatientDashboard />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["reception"]} />}>
            <Route path="/reception" element={<ReceptionDashboard />} />
          </Route>

          {/* Change password: allow any authenticated role (admin/doctor/reception/patient) */}
          <Route element={<ProtectedRoute allowedRoles={['admin','doctor','reception','patient']} />}>
            <Route path="/change-password" element={<ChangePassword />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<div className="p-6 bg-white rounded shadow">404 — not found</div>} />
        </Routes>
      </main>
    </div>
  );
}
