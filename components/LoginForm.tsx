"use client"
import React, { useState } from 'react'
import Input from './Input'
import Button from './Button'
import { useRouter } from 'next/navigation'
import { validateEmail, validatePassword } from '../lib/validators'

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fe: { email?: string; password?: string } = {}
    if (!validateEmail(email)) fe.email = 'Email inválido'
    if (!validatePassword(password)) fe.password = 'Contraseña requerida'
    setFieldErrors(fe)
    if (Object.keys(fe).length) return

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'Error desconocido')
        setLoading(false)
        return
      }

      // Success: server sets HTTP-only cookie
      router.push('/dashboard')
    } catch (err) {
      setError('Error de red')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      {error ? <p className="text-red-600 text-sm">{error}</p> : null}

      <Button type="submit" loading={loading}>
        Entrar
      </Button>

      <div className="text-center space-y-3">
        <div>
          <a href="#" className="text-sm text-blue-600 hover:underline">
            ¿Olvidó su contraseña?
          </a>
        </div>
        <p className="text-sm text-gray-600">
          ¿No tienes cuenta?{' '}
          <a href="/register" className="text-blue-600 hover:underline">
            Regístrate aquí
          </a>
        </p>
      </div>
    </form>
  )
}
