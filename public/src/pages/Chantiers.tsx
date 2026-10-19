import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Badge from '../components/Badge'
import Progression from '../components/Progression'
import { dateFr } from '../lib/format'
import { supabase } from '../lib/supabase'
import { btn, carte } from '../lib/ui'
import { LIBELLE_STATUT, LIBELLE_TRAVAUX, peutGerer, type Chantier, type StatutChantier } from '../types'

const FILTRES: (StatutChantier | 'tous')[] = ['tous', 'en_cours', 'a_planifier', 'en_pause', 'termine', 'annule']

export default function Chantiers() {
  const { profil } = useAuth()
  const [liste, setListe] = useState<Chantier[]>([])
  const [filtre, setFiltre] = useState<StatutChantier | 'tous'>('tous')
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    supabase.from('chantiers').select('*, clients(nom)').order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setErreur(error.message)
        else setListe(data as Chantier[])
      })
  }, [])

  const affiches = liste.filter((c) => filtre === 'tous' || c.statut === filtre)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Chantiers ({liste.length})</h1>
        {peutGerer(profil?.role) && <Link to="/chantiers/nouveau" className={btn}>Nouveau chantier</Link>}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTRES.map((f) => (
          <button
            key={f}
            onClick={() => setFiltre(f)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${filtre === f ? 'bg-nuit text-white' : 'bg-white'}`}
          >
            {f === 'tous' ? 'Tous' : LIBELLE_STATUT[f]}
          </button>
        ))}
      </div>
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {affiches.map((c) => (
        <Link key={c.id} to={`/chantiers/${c.id}`} className={`${carte} block space-y-2`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{c.titre}</p>
              <p className="text-sm text-gray-500">{c.clients?.nom ?? 'Client non renseigné'} · {LIBELLE_TRAVAUX[c.type_travaux]}</p>
            </div>
            <Badge statut={c.statut} />
          </div>
          <Progression pct={c.avancement_pct} />
          <p className="text-xs text-gray-500">Fin prévue : {dateFr(c.date_fin_prevue)} · {c.avancement_pct} %</p>
        </Link>
      ))}
      {!affiches.length && <p className="text-center text-gray-500">Aucun chantier.</p>}
    </div>
  )
}
