'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type ProtectedRouteProps = {
  children: React.ReactNode
  allowedRoles: string[]
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const router = useRouter()
  const [isAllowed, setIsAllowed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAccess() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (!res.ok) {
          router.push('/login')
          return
        }
        const data = await res.json()
        const userRole = data.user?.role
        
        if (!userRole || !allowedRoles.includes(userRole)) {
          router.push('/dashboard')
          return
        }
        
        setIsAllowed(true)
      } catch (error) {
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    checkAccess()
  }, [allowedRoles, router])

  if (loading) return <div className="p-4">Validando acceso...</div>
  if (!isAllowed) return null

  return <>{children}</>
}
