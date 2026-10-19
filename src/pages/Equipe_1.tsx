import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'
import { carte, champ } from '../lib/ui'
import { LIBELLE_ROLE, type Profil, type Role } from '../types'

export default function Equipe() {
  const { profil, session } = useAuth()
  const [membres, setMembres] = useState<Profil[]>([])
  const [erreur, setErreur] = useState('')

  async function charger() {
    const { data, error } = await supabase.from('profils').select('*').order('nom')
    if (error) setErreur(error.message)
    else setMembres(data as Profil[])
  }
  useEffect(() => { void charger() }, [])

  if (profil?.role !== 'gerant') return <p className={carte}>Accès réservé au gérant.</p>

  async function modifier(id: string, champs: Partial<Profil>) {
    const { error } = await supabase.from('profils').update(champs).eq('id', id)
    setErreur(error ? error.message : '')
    await charger()
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Équipe ({membres.length})</h1>
      <p className="text-sm text-gray-500">
        Pour ajouter quelqu'un : Supabase &gt; Authentication &gt; Users &gt; Add user. Son profil apparaît ici, avec le rôle Ouvrier par défaut.
      </p>
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {membres.map((m) => {
        const moi = m.id === session?.user.id
        return (
          <div key={m.id} className={`${carte} space-y-2 ${m.actif ? '' : 'opacity-60'}`}>
            <p className="font-semibold">{m.nom}{moi && ' (vous)'}</p>
            <div className="flex gap-2">
              <select className={champ} value={m.role} disabled={moi} onChange={(e) => void modifier(m.id, { role: e.target.value as Role })} aria-label={`Rôle de ${m.nom}`}>
                {Object.entries(LIBELLE_ROLE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <input
                className={champ}
                type="tel"
                placeholder="Téléphone"
                defaultValue={m.telephone ?? ''}
                onBlur={(e) => { if (e.target.value !== (m.telephone ?? '')) void modifier(m.id, { telephone: e.target.value || null }) }}
                aria-label={`Téléphone de ${m.nom}`}
              />
            </div>
            {!moi && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={m.actif} onChange={(e) => void modifier(m.id, { actif: e.target.checked })} />
                Compte actif
              </label>
            )}
          </div>
        )
      })}
    </div>
  )
}
