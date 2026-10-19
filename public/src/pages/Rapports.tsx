import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Progression from '../components/Progression'
import { aujourdhui, dateFr } from '../lib/format'
import { supabase } from '../lib/supabase'
import { btn, carte, champ } from '../lib/ui'
import { peutGerer, type Rapport } from '../types'

interface Manquant { id: string; titre: string }

export default function Rapports() {
  const { profil, session } = useAuth()
  const [liste, setListe] = useState<Rapport[]>([])
  const [chantiers, setChantiers] = useState<{ id: string; titre: string }[]>([])
  const [manquants, setManquants] = useState<Manquant[]>([])
  const [filtre, setFiltre] = useState('')
  const [incidentsSeuls, setIncidentsSeuls] = useState(false)
  const [erreur, setErreur] = useState('')
  const peutEcrire = peutGerer(profil?.role) || profil?.role === 'chef_chantier'

  useEffect(() => {
    void (async () => {
      const [r, c, auj] = await Promise.all([
        supabase.from('rapports').select('*, chantiers(titre)').order('date_rapport', { ascending: false }).order('created_at', { ascending: false }).limit(200),
        supabase.from('chantiers').select('id, titre, chef_id, statut').order('titre'),
        supabase.from('rapports').select('chantier_id').eq('date_rapport', aujourdhui()),
      ])
      if (r.error) return setErreur(r.error.message)
      setListe((r.data ?? []) as Rapport[])
      const tous = (c.data ?? []) as { id: string; titre: string; chef_id: string | null; statut: string }[]
      setChantiers(tous.map(({ id, titre }) => ({ id, titre })))
      if (peutEcrire) {
        const faits = new Set((auj.data ?? []).map((x) => x.chantier_id as string))
        setManquants(
          tous
            .filter((x) => x.statut === 'en_cours' && !faits.has(x.id))
            .filter((x) => peutGerer(profil?.role) || x.chef_id === session?.user.id)
            .map(({ id, titre }) => ({ id, titre })),
        )
      }
    })()
  }, [profil?.role])

  const affiches = liste.filter((r) => (!filtre || r.chantier_id === filtre) && (!incidentsSeuls || r.incident))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Rapports journaliers</h1>
        {peutEcrire && <Link to="/rapports/nouveau" className={btn}>Nouveau rapport</Link>}
      </div>

      {manquants.length > 0 && (
        <div className={`${carte} space-y-2 border border-orange-200 bg-orange-50`}>
          <p className="font-semibold text-orange-800">À remplir aujourd'hui ({manquants.length})</p>
          {manquants.map((m) => (
            <Link key={m.id} to={`/rapports/nouveau?chantier=${m.id}`} className="flex items-center justify-between text-sm">
              <span>{m.titre}</span><span className="underline">Écrire le rapport</span>
            </Link>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <select className={champ} value={filtre} onChange={(e) => setFiltre(e.target.value)} aria-label="Filtrer par chantier">
          <option value="">Tous les chantiers</option>
          {chantiers.map((c) => <option key={c.id} value={c.id}>{c.titre}</option>)}
        </select>
        <label className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold">
          <input type="checkbox" checked={incidentsSeuls} onChange={(e) => setIncidentsSeuls(e.target.checked)} /> Incidents
        </label>
      </div>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {affiches.map((r) => (
        <Link key={r.id} to={`/rapports/${r.id}`} className={`${carte} block space-y-2`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{r.chantiers?.titre ?? 'Chantier'}</p>
              <p className="text-sm text-gray-500">{dateFr(r.date_rapport)}</p>
            </div>
            {r.incident && <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">Incident</span>}
          </div>
          <p className="line-clamp-2 text-sm">{r.travaux}</p>
          <Progression pct={r.avancement_pct} />
        </Link>
      ))}
      {!affiches.length && <p className="text-center text-gray-500">Aucun rapport.</p>}
    </div>
  )
}
