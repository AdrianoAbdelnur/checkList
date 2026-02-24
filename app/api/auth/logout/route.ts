import { NextRequest, NextResponse } from 'next/server'
import { deleteSession } from '../../../../lib/auth'
import { clearSessionCookie } from '@/lib/server/session-cookie'

export async function POST(req: NextRequest) {
  const token = req.cookies.get('session')?.value
  await deleteSession(token)

  const res = NextResponse.json({ ok: true })
  clearSessionCookie(res)
  return res
}
