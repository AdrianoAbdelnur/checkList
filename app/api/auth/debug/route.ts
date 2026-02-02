import { NextRequest, NextResponse } from 'next/server'
import { getSessionsDebug } from '../../../../lib/auth'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('session')?.value
  const allSessions = await getSessionsDebug()

  return NextResponse.json({
    tokenFromCookie: token || null,
    allSessionsInMemory: allSessions,
    sessionCount: allSessions.length,
    tokenMatch: allSessions.find((s: any) => s.token === token) ? 'MATCH' : 'NO MATCH',
  })
}

