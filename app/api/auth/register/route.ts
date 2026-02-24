import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '../../../../lib/mongoose'
import User from '../../../../models/User'
import crypto from 'crypto'
import { validateEmail, validatePassword } from '../../../../lib/validators'
import { createSession } from '../../../../lib/auth'
import { setSessionCookie } from '@/lib/server/session-cookie'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))

  const errors: { email?: string; password?: string } = {}
  if (!validateEmail(body.email)) errors.email = 'Email inválido'
  if (!validatePassword(body.password)) errors.password = 'Contraseña requerida'
  if (Object.keys(errors).length) return NextResponse.json({ error: 'Datos inválidos', details: errors }, { status: 400 })

  await connectToDatabase()

  const existing = await User.findOne({ email: body.email }).lean()
  if (existing) return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 })

  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(body.password, salt, 64).toString('hex')

  const user = new User({
    firstName: body.firstName || '',
    lastName: body.lastName || '',
    email: body.email,
    password: derived,
    salt,
  })

  await user.save()

  // Create server-side session
  const token = await createSession(user._id.toString())

  const res = NextResponse.json({ user: { id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName } }, { status: 201 })
  setSessionCookie(res, token)

  return res
}
