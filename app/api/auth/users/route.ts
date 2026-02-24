import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '../../../../lib/mongoose'
import User from '../../../../models/User'
import crypto from 'crypto'
import { requireAdminSession } from '@/lib/server/auth-next'
import { isAppRole } from '@/lib/roles'

export async function GET(req: NextRequest) {
  const auth = await requireAdminSession(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  await connectToDatabase()
  try {
    const users = await User.find({ isDelete: { $ne: true } }).select('-password -salt').lean()
    return NextResponse.json({ users })
  } catch {
    return NextResponse.json({ error: 'Error al listar usuarios' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const { firstName, lastName, email, password, role, telephone } = body
  if (!email || !password) return NextResponse.json({ error: 'Email y password son requeridos' }, { status: 400 })
  if (role !== undefined && !isAppRole(String(role))) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
  }

  await connectToDatabase()
  try {
    const existing = await User.findOne({ email }).lean()
    if (existing) return NextResponse.json({ error: 'Email ya registrado' }, { status: 409 })

    const salt = crypto.randomBytes(16).toString('hex')
    const derived = crypto.scryptSync(password, salt, 64).toString('hex')

    const user = new User({
        firstName: firstName || '',
        lastName: lastName || '',
        email,
        password: derived,
        salt,
        role: isAppRole(String(role)) ? role : 'inspector',
        telephone: telephone || '',
    })
    await user.save()
    const u = await User
        .findById(user._id)
        .select('-password -salt')
        .lean()

return NextResponse.json({ user: u  }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 })
  }
}
