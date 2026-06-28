import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

interface Props {
  /** If provided, only users with one of these roles can access the route. */
  allowedRoles?: string[]
}

export default function ProtectedRoute({ allowedRoles }: Props) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles) {
    // user not loaded yet → send to login to re-authenticate
    if (!user) return <Navigate to="/login" replace />

    if (!allowedRoles.includes(user.role)) {
      const fallback = user.role === 'CASHIER' ? '/pos' : '/dashboard'
      return <Navigate to={fallback} replace />
    }
  }

  return <Outlet />
}
