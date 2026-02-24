import { NextRequest, NextResponse } from 'next/server'
import { requireAuthSession } from '@/lib/server/auth-next'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthSession(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    return NextResponse.json({ user: auth.session })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
