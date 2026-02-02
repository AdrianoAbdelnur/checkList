'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type User = {
  email: string
  firstName: string
  lastName: string
  role: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setUser(data.user)
        } else {
          router.push('/login')
        }
      } catch {
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [router])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    router.push('/login')
  }

  if (loading) return <div className="p-4">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Cerrar sesión
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Bienvenido, {user?.firstName} {user?.lastName}</h2>
          <p className="text-gray-600">Email: {user?.email}</p>
          <p className="text-gray-600">Rol: <span className="font-semibold capitalize">{user?.role}</span></p>
        </div>

        {user?.role === 'admin' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Panel Administrador</h3>
            <p className="text-blue-700">Acceso a todas las funciones administrativas</p>
            <a href="/admin" className="mt-3 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Ir al Panel Admin
            </a>
          </div>
        )}

        {user?.role === 'technician' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-900 mb-2">Panel Técnico</h3>
            <p className="text-green-700">Acceso a herramientas técnicas</p>
            <a href="/technician" className="mt-3 inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              Ir al Panel Técnico
            </a>
          </div>
        )}

        {user?.role === 'operators' && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-purple-900 mb-2">Panel de Operadores</h3>
            <p className="text-purple-700">Acceso a operaciones</p>
            <a href="/operators" className="mt-3 inline-block px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
              Ir al Panel de Operadores
            </a>
          </div>
        )}

        {user?.role === 'managers' && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-orange-900 mb-2">Panel de Gerentes</h3>
            <p className="text-orange-700">Acceso a gestión</p>
            <a href="/managers" className="mt-3 inline-block px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">
              Ir al Panel de Gerentes
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
