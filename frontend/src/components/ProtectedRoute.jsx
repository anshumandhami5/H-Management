import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export default function ProtectedRoute({ allowedRoles = [] }){
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return (
      <div>
        <h2>Forbidden</h2>
        <p className="small">You do not have permission to view this page.</p>
      </div>
    )
  }

  return <Outlet />
}
