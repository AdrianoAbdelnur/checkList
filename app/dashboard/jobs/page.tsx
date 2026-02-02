'use client'
import  { useEffect, useState } from 'react'

type Technician = { _id: string; firstName: string; lastName: string }

type Job = {
  _id: string
  type: string
  scheduledAt?: string
  technician?: Technician
  client?: { _id: string; companyName: string }
  address?: string
  notes?: string
  status: string
}

export default function ManagerJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [mode, setMode] = useState<'create' | 'edit'>('create')

  async function fetchJobs() {
    setLoading(true)
    try {
      const res = await fetch('/api/jobs', { credentials: 'include' })
      if (!res.ok) throw new Error('Error al cargar turnos')
      const data = await res.json()
      setJobs(data.jobs || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchJobs() }, [])

  function openCreate() { setSelectedJob(null); setMode('create'); setShowModal(true) }
  function openEdit(job: Job) { setSelectedJob(job); setMode('edit'); setShowModal(true) }

  async function handleDelete(id: string) {
    if (!confirm('Eliminar turno?')) return
    try {
      const res = await fetch(`/api/jobs/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Error al eliminar')
      }
      await fetchJobs()
    } catch (e: any) { setError(e.message) }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Turnos - Manager</h1>
        <button onClick={openCreate} className="px-4 py-2 bg-green-600 text-white rounded">+ Crear turno</button>
      </div>

      {loading ? (
        <div className="text-gray-500">Cargando turnos...</div>
      ) : error ? (
        <div className="text-red-600 bg-red-50 p-4 rounded">{error}</div>
      ) : (
        <div className="bg-white rounded shadow overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 text-left font-semibold text-sm">Tipo</th>
                <th className="p-4 text-left font-semibold text-sm">Fecha</th>
                <th className="p-4 text-left font-semibold text-sm">Técnico</th>
                <th className="p-4 text-left font-semibold text-sm">Empresa</th>
                <th className="p-4 text-left font-semibold text-sm">Estado</th>
                <th className="p-4 text-left font-semibold text-sm">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-500">No hay turnos</td>
                </tr>
              ) : (
                jobs.map(j => (
                  <tr key={j._id} className="border-t hover:bg-gray-50">
                    <td className="p-4">{j.type}</td>
                    <td className="p-4">{j.scheduledAt ? new Date(j.scheduledAt).toLocaleString('es-AR') : '-'}</td>
                    <td className="p-4">{j.technician ? `${j.technician.firstName} ${j.technician.lastName}` : '-'}</td>
                    <td className="p-4">{j.client ? j.client.companyName : '-'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        j.status === 'done' ? 'bg-green-100 text-green-800' :
                        j.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        j.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {j.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <button onClick={() => openEdit(j)} className="mr-2 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600">Editar</button>
                      <button onClick={() => handleDelete(j._id)} className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700">Borrar</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
