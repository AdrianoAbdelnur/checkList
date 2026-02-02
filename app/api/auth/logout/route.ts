import { NextRequest, NextResponse } from 'next/server'
import { deleteSession } from '../../../../lib/auth'

export async function POST(req: NextRequest) {
  const token = req.cookies.get('session')?.value
  deleteSession(token)

  const res = NextResponse.json({ ok: true })
  res.cookies.set({
    name: 'session',
    value: '',
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  })
  return res
}
