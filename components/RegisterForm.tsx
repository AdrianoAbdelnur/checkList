"use client"
import React, { useState } from 'react'
import Input from './Input'
import Button from './Button'
import { useRouter } from 'next/navigation'
import { validateEmail, validatePassword } from '../lib/validators'

export default function RegisterForm() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ firstName?: string; lastName?: string; email?: string; password?: string; confirmPassword?: string }>({})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fe: { firstName?: string; lastName?: string; email?: string; password?: string; confirmPassword?: string } = {}

    if (!firstName.trim()) fe.firstName = 'Nombre requerido'
    if (!lastName.trim()) fe.lastName = 'Apellido requerido'
    if (!validateEmail(email)) fe.email = 'Email inválido'
    if (!validatePassword(password)) fe.password = 'Contraseña requerida'
    if (password !== confirmPassword) fe.confirmPassword = 'Las contraseñas no coinciden'
    if (password.length < 6) fe.password = 'Mínimo 6 caracteres'

    setFieldErrors(fe)
    if (Object.keys(fe).length) return

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ firstName, lastName, email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'Error desconocido')
        setLoading(false)
        return
      }

      
      router.push('/dashboard')
    } catch (err) {
      setError('Error de red')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="firstName"
        name="firstName"
        type="text"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        placeholder="Nombre"
        error={fieldErrors.firstName}
        icon={
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-gray-400">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.2"></circle>
            <path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        }
      />

      <Input
        id="lastName"
        name="lastName"
        type="text"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        placeholder="Apellido"
        error={fieldErrors.lastName}
        icon={
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-gray-400">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.2"></circle>
            <path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        }
      />

      <Input
        id="email"
        name="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="correo@empresa.com"
        error={fieldErrors.email}
        icon={
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-gray-400">
            <path d="M4 4h16v16H4z" fill="none"></path>
            <path d="M4 7l8 5 8-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
      />

      <Input
        id="password"
        name="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Contraseña"
        error={fieldErrors.password}
        icon={
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-gray-400">
            <rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.2"></rect>
            <path d="M7 11V8a5 5 0 0110 0v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        }
      />

      <Input
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Confirmar contraseña"
        error={fieldErrors.confirmPassword}
        icon={
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-gray-400">
            <rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.2"></rect>
            <path d="M7 11V8a5 5 0 0110 0v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        }
      />

      {error ? <p className="text-red-600 text-sm">{error}</p> : null}

      <Button type="submit" loading={loading}>
        Registrarse
      </Button>

      <div className="text-center">
        <p className="text-sm text-gray-600">
          ¿Ya tienes cuenta?{' '}
          <a href="/login" className="text-blue-600 hover:underline">
            Inicia sesión
          </a>
        </p>
      </div>
    </form>
  )
}
