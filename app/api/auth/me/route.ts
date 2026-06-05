import { NextRequest, NextResponse } from 'next/server'
import { deleteSession } from '@/lib/auth'
import { requireUser } from '@/lib/auth/requireUser'
import { clearSessionCookie } from '@/lib/server/session-cookie'
import { connectToDatabase } from '@/lib/mongoose'
import User from '@/models/User'
import { requireAuthSession } from '@/lib/server/auth-next'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthSession(req, { allowMustChangePassword: true })
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    return NextResponse.json({ user: auth.session })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireUser(req, { allowMustChangePassword: true })
    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status })
    }

    await connectToDatabase()

    const userId = String((auth.user as any)._id)
    const updated = await User.findByIdAndUpdate(
      userId,
      {
        isDelete: true,
        deletionRequestedByUser: true,
        deletionRequestedAt: new Date(),
        deletionRequestSource: 'mobile',
      },
      { new: true },
    )
      .select('-password -salt')
      .lean()

    if (!updated) {
      return NextResponse.json({ ok: false, message: 'Usuario no encontrado' }, { status: 404 })
    }

    const token = (req.headers.get('x-session-token') ?? '').trim() || req.cookies.get('session')?.value
    await deleteSession(token)

    const res = NextResponse.json({
      ok: true,
      message: 'Cuenta marcada para eliminacion',
      user: updated,
    })
    clearSessionCookie(res)
    return res
  } catch {
    return NextResponse.json({ ok: false, message: 'Error interno' }, { status: 500 })
  }
}
