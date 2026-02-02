import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '../../../../../lib/mongoose'
import User from '../../../../../models/User'
import { getSessionData } from '../../../../../lib/auth'

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get('session')?.value
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const sessionData = await getSessionData(token)
  if (!sessionData || sessionData.role !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores pueden editar usuarios' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { firstName, lastName, telephone, userId, role } = body

  if (!userId) {
    return NextResponse.json({ error: 'userId es requerido' }, { status: 400 })
  }

  const validRoles = ['user', 'admin', 'technician', 'operators', 'managers']
  if (role && !validRoles.includes(role)) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
  }

  const update: any = {}
  if (firstName !== undefined) update.firstName = firstName
  if (lastName !== undefined) update.lastName = lastName
  if (telephone !== undefined) update.telephone = telephone
  if (role !== undefined) update.role = role

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
  }

  await connectToDatabase()

  try {
    const updatedUser = await User
      .findByIdAndUpdate(userId, update, { new: true })
      .select('-password -salt')

    if (!updatedUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ user: updatedUser })
  } catch {
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get('session')?.value
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const session = await getSessionData(token)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  // ID comes from the route param
  const { searchParams } = new URL(req.url)
  // note: Next's dynamic route param is in pathname; extract id from pathname
  const parts = req.nextUrl.pathname.split('/')
  const targetId = parts[parts.length - 1]
  if (!targetId) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  await connectToDatabase()
  try {
    const deleted = await User.findByIdAndUpdate(targetId, { isDelete: true }, { new: true }).select('-password -salt')
    if (!deleted) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    return NextResponse.json({ ok: true, user: deleted })
  } catch (e) {
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 })
  }
}
