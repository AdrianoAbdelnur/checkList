import { NextRequest, NextResponse } from 'next/server'
import { getSessionData } from '../../../../lib/auth'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('session')?.value
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  try {
    const sessionData = await getSessionData(token)
    if (!sessionData) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    return NextResponse.json({ user: sessionData })
  } catch (e) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
