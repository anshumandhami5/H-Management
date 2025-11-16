// src/components/StatCard.jsx
import React from 'react';

export default function StatCard({ label, value, hint }) {
  return (
    <div className="stat card">
      <div className="label muted">{label}</div>
      <div className="value">{value}</div>
      {hint && <div style={{marginTop:8,color:'#6b7280',fontSize:13}}>{hint}</div>}
    </div>
  );
}
