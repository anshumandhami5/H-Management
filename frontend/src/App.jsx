// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

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
 * - Redirects logged-in users to their dashboard
 * - Redirects visitors to /login
 */
function Home() {
  const { user, ready } = useAuth();

  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;

  const role = user.role;
  if (role === "admin") return <Navigate to="/admin" replace />;
  if (role === "doctor") return <Navigate to="/doctor" replace />;
  if (role === "reception") return <Navigate to="/reception" replace />;
  if (role === "patient") return <Navigate to="/patient" replace />;

  return <Navigate to="/login" replace />;
}

export default function App() {
  const { ready } = useAuth();

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto p-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* Patient booking */}
          <Route element={<ProtectedRoute allowedRoles={["patient"]} />}>
            <Route path="/book" element={<PatientBooking />} />
          </Route>

          {/* Role-based dashboards */}
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

          {/* Change password (all roles) */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={["admin", "doctor", "reception", "patient"]}
              />
            }
          >
            <Route path="/change-password" element={<ChangePassword />} />
          </Route>

          {/* 404 */}
          <Route
            path="*"
            element={<div className="p-6 bg-white rounded shadow">404 — not found</div>}
          />
        </Routes>
      </main>
    </div>
  );
}
