import { connectToDatabase } from './mongoose'
import User, { IUser } from '../models/User'
import Session from '../models/Session'
import crypto from 'crypto'
import { getPrimaryRole, normalizeRoles } from './roles'

export type SessionData = {
  userId: string
  email: string
  firstName: string
  lastName: string
  role: string
  roles: string[]
}

export async function getUserById(userId: string): Promise<(Omit<IUser, 'password' | 'salt'> & { _id: any }) | null> {
  try {
    await connectToDatabase()
    const user = await User.findById(userId).select('-password -salt').lean()
    return user
  } catch (e) {
    return null
  }
}

export async function createSession(userId: string): Promise<string> {
  await connectToDatabase()
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  try {
    await Session.create({ token, userId, expiresAt })
  } catch (e) {
    console.error('Error creating session:', e)
  }

  return token
}

export async function getSessionData(token?: string): Promise<SessionData | null> {
  if (!token) return null

  try {
    await connectToDatabase()
    const session = await Session.findOne({ token }).lean()
    
    if (!session || session.expiresAt < new Date()) {
      if (session) await Session.deleteOne({ token })
      return null
    }

    const user = await getUserById(session.userId)
    if (!user) return null

    const roles = normalizeRoles({
      role: user.role || 'inspector',
      roles: Array.isArray((user as any).roles) ? (user as any).roles : undefined,
    })

    return {
      userId: session.userId,
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      role: getPrimaryRole({ role: user.role || 'inspector', roles }),
      roles,
    }
  } catch (e) {
    console.error('Error getting session data:', e)
    return null
  }
}

export async function deleteSession(token?: string): Promise<void> {
  if (!token) return
  try {
    await connectToDatabase()
    await Session.deleteOne({ token })
  } catch (e) {
    console.error('Error deleting session:', e)
  }
}

export function isValidRole(role: string, allowedRoles: string[]): boolean {
  return allowedRoles.includes(role)
}

// DEBUG: get all sessions
export async function getSessionsDebug() {
  try {
    await connectToDatabase()
    const sessions = await Session.find({}).select('token userId expiresAt').lean()
    return sessions
  } catch (e) {
    return []
  }
}
