// src/components/Topbar.jsx
import React from "react";

export default function Topbar({ title, right }) {
  return (
    <header className="flex items-center justify-between py-4 px-6 bg-white dark:bg-gray-900 border-b">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
      </div>
      <div>{right}</div>
    </header>
  );
}
