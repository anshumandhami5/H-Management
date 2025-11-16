// src/components/Sidebar.jsx
import React from "react";
import { NavLink } from "react-router-dom";

export default function Sidebar({ role }) {
  const links = [
    { to: "/admin", label: "Admin Dashboard", roles: ["admin"] },
    { to: "/doctor", label: "Doctor Dashboard", roles: ["doctor"] },
    { to: "/reception", label: "Reception Dashboard", roles: ["reception"] },
    { to: "/patient", label: "Patient Dashboard", roles: ["patient"] },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r h-screen p-4">
      <div className="mb-6">
        <div className="text-2xl font-bold text-emerald-600">HMS</div>
        <div className="text-sm text-gray-500">Hospital Management System</div>
      </div>

      <nav className="flex flex-col gap-2">
        {links.map((l) =>
          l.roles.includes(role) ? (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm ${
                  isActive ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-gray-700 hover:bg-gray-100"
                }`
              }
            >
              {l.label}
            </NavLink>
          ) : null
        )}
      </nav>
    </aside>
  );
}
