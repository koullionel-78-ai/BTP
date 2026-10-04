import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { BadgeDevis } from '../components/BadgeDoc'
import { dateFr, fcfa } from '../lib/format'
import { supabase } from '../lib/supabase'
import { btn, carte, champ } from '../lib/ui'
import { LIBELLE_DEVIS, peutGerer, type Devis, type StatutDevis } from '../types'

const FILTRES: (StatutDevis | 'tous')[] = ['tous', 'brouillon', 'envoye', 'accepte', 'refuse']

export default function DevisListe() {
  const { profil } = useAuth()
  const [liste, setListe] = useState<Devis[]>([])
  const [filtre, setFiltre] = useState<StatutDevis | 'tous'>('tous')
  const [q, setQ] = useState('')
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    supabase.from('devis_totaux').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) setErreur(error.message)
      else setListe(data as Devis[])
    })
  }, [])

  if (!peutGerer(profil?.role)) return <p className={carte}>Accès non autorisé.</p>

  const terme = q.toLowerCase()
  const affiches = liste.filter(
    (d) => (filtre === 'tous' || d.statut === filtre) &&
      (d.numero.toLowerCase().includes(terme) || d.client_nom.toLowerCase().includes(terme) || d.objet.toLowerCase().includes(terme)),
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Devis ({liste.length})</h1>
        <Link to="/devis/nouveau" className={btn}>Nouveau devis</Link>
      </div>
      <input className={champ} placeholder="Rechercher un numéro, un client, un objet" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTRES.map((f) => (
          <button key={f} onClick={() => setFiltre(f)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${filtre === f ? 'bg-nuit text-white' : 'bg-white'}`}>
            {f === 'tous' ? 'Tous' : LIBELLE_DEVIS[f]}
          </button>
        ))}
      </div>
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {affiches.map((d) => (
        <Link key={d.id} to={`/devis/${d.id}`} className={`${carte} block space-y-1`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{d.numero} · {d.client_nom}</p>
              <p className="text-sm text-gray-500">{d.objet}</p>
            </div>
            <BadgeDevis statut={d.statut} />
          </div>
          <p className="text-sm"><b>{fcfa(d.total_ttc)}</b> <span className="text-gray-500">· {dateFr(d.date_emission)}</span></p>
        </Link>
      ))}
      {!affiches.length && <p className="text-center text-gray-500">Aucun devis.</p>}
    </div>
  )
}
