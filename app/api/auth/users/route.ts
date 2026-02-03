import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '../../../../lib/mongoose'
import User from '../../../../models/User'
import crypto from 'crypto'
import { getSessionData } from '../../../../lib/auth'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('session')?.value
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const session = await getSessionData(token)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  await connectToDatabase()
  try {
    const users = await User.find({ isDelete: { $ne: true } }).select('-password -salt').lean()
    return NextResponse.json({ users })
  } catch (e) {
    return NextResponse.json({ error: 'Error al listar usuarios' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('session')?.value
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const session = await getSessionData(token)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { firstName, lastName, email, password, role, telephone } = body
  if (!email || !password) return NextResponse.json({ error: 'Email y password son requeridos' }, { status: 400 })

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
        role: role || 'user',
        telephone: telephone || '',
    })
    await user.save()
    const u = await User
        .findById(user._id)
        .select('-password -salt')
        .lean()

return NextResponse.json({ user: u  }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 })
  }
}
