import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profil } from '../types'

interface Contexte {
  session: Session | null
  profil: Profil | null
  chargement: boolean
  deconnexion: () => Promise<void>
}

const AuthContext = createContext<Contexte | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profil, setProfil] = useState<Profil | null>(null)
  const [pret, setPret] = useState(false)
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setPret(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!pret) return
    if (!session) {
      setProfil(null)
      setChargement(false)
      return
    }
    setChargement(true)
    supabase
      .from('profils')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        setProfil((data as Profil | null) ?? null)
        setChargement(false)
      })
  }, [session, pret])

  const deconnexion = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, profil, chargement, deconnexion }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const c = useContext(AuthContext)
  if (!c) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return c
}
