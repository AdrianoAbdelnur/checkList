'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ThemeShell from '@/components/checklists/ThemeShell'
import { roleLabelEs } from '@/lib/roles'
import styles from './page.module.css'

type User = {
  email: string
  firstName: string
  lastName: string
  role: string
}

type RoleCard = {
  role: string
  title: string
  description: string
  href: string
  tone: 'blue' | 'green' | 'violet'
}

const roleCards: RoleCard[] = [
  {
    role: 'admin',
    title: 'Panel Administrador',
    description: 'Acceso a funciones administrativas y gestión global.',
    href: '/admin',
    tone: 'blue',
  },
  {
    role: 'inspector',
    title: 'Panel de Inspector',
    description: 'Carga y seguimiento de checklists de inspección.',
    href: '/checklists',
    tone: 'green',
  },
  {
    role: 'reviewer',
    title: 'Panel de Revisor',
    description: 'Revisión de checklists, validación y decisiones.',
    href: '/templates/edition',
    tone: 'violet',
  },
]

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setUser(data.user)
        } else {
          router.push('/login')
        }
      } catch {
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [router])

  if (loading) {
    return (
      <ThemeShell>
        <div className={styles.loadingWrap}>
          <div className={styles.loadingCard}>Cargando dashboard...</div>
        </div>
      </ThemeShell>
    )
  }

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.email || 'Usuario'
  const activeRoleCard = roleCards.find((r) => r.role === user?.role)

  return (
    <ThemeShell user={user}>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroMain}>
            <p className={styles.kicker}>Centro de control</p>
            <h1>Dashboard</h1>
            <p className={styles.subtitle}>
              Acceso rápido a checklists y módulos según tu perfil.
            </p>
          </div>
        </section>

        <section className={styles.grid}>
          <article className={styles.profileCard}>
            <div className={styles.profileHeader}>
              <div className={styles.avatar}>{displayName.slice(0, 1).toUpperCase()}</div>
              <div>
                <h2>{displayName}</h2>
                <p>{user?.email}</p>
              </div>
            </div>

            <div className={styles.profileMeta}>
              <div>
                <span>Rol</span>
                <strong>{roleLabelEs(user?.role)}</strong>
              </div>
              <div>
                <span>Sesión</span>
                <strong>Activa</strong>
              </div>
              <div>
                <span>Módulo principal</span>
                <strong>Checklists</strong>
              </div>
              <div>
                <span>Acceso</span>
                <strong>{activeRoleCard ? 'Personalizado' : 'Estándar'}</strong>
              </div>
            </div>
          </article>

          <article className={styles.quickCard}>
            <div className={styles.quickCardHeader}>
              <h3>Accesos rápidos</h3>
              <span>Operación diaria</span>
            </div>
            <div className={styles.quickActions}>
              <a href="/checklists" className={styles.quickBtn}>
                Abrir listados de checklists
              </a>
              <a href="/checklists" className={styles.quickBtnGhost}>
                Ir por enlace directo
              </a>
            </div>
          </article>
        </section>

        {activeRoleCard ? (
          <section className={`${styles.rolePanel} ${styles[activeRoleCard.tone]}`}>
            <div>
              <p className={styles.roleKicker}>Módulo habilitado</p>
              <h3>{activeRoleCard.title}</h3>
              <p>{activeRoleCard.description}</p>
            </div>
            <a href={activeRoleCard.href} className={styles.roleLink}>
              Abrir módulo
            </a>
          </section>
        ) : null}
      </main>
    </ThemeShell>
  )
}
