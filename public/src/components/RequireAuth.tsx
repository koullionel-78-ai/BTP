import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { session, chargement } = useAuth()
  if (chargement) return <p className="p-6 text-center text-gray-500">Chargement…</p>
  if (!session) return <Navigate to="/connexion" replace />
  return <>{children}</>
}
