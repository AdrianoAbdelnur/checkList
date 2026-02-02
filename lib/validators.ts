export function validateEmail(email?: string): boolean {
  if (!email) return false
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

export function validatePassword(p?: string): boolean {
  return typeof p === 'string' && p.trim().length > 0
}

export function validateLoginPayload(payload: { email?: string; password?: string }) {
  const errors: { email?: string; password?: string } = {}
  if (!validateEmail(payload.email)) errors.email = 'Email inválido'
  if (!validatePassword(payload.password)) errors.password = 'Contraseña requerida'
  return errors
}
