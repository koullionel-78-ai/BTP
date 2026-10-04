import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { BadgeFacture } from '../components/BadgeDoc'
import { dateFr, fcfa } from '../lib/format'
import { supabase } from '../lib/supabase'
import { btn, carte, champ } from '../lib/ui'
import { etatFacture, LIBELLE_ETAT, peutGerer, type EtatFacture, type Facture } from '../types'

const FILTRES: (EtatFacture | 'toutes')[] = ['toutes', 'a_encaisser', 'echue', 'payee', 'annulee']

export default function Factures() {
  const { profil } = useAuth()
  const [liste, setListe] = useState<Facture[]>([])
  const [filtre, setFiltre] = useState<EtatFacture | 'toutes'>('toutes')
  const [q, setQ] = useState('')
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    supabase.from('factures_totaux').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) setErreur(error.message)
      else setListe(data as Facture[])
    })
  }, [])

  if (!peutGerer(profil?.role)) return <p className={carte}>Accès non autorisé.</p>

  const avecEtat = liste.map((f) => ({ f, etat: etatFacture(f) }))
  const somme = (e: EtatFacture) => avecEtat.filter((x) => x.etat === e).reduce((s, x) => s + x.f.reste, 0)
  const terme = q.toLowerCase()
  const affichees = avecEtat.filter(
    (x) => (filtre === 'toutes' || x.etat === filtre) &&
      (x.f.numero.toLowerCase().includes(terme) || x.f.client_nom.toLowerCase().includes(terme) || x.f.objet.toLowerCase().includes(terme)),
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Factures ({liste.length})</h1>
        <Link to="/factures/nouvelle" className={btn}>Nouvelle facture</Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className={carte}><p className="text-sm text-gray-500">À encaisser</p><p className="text-lg font-bold">{fcfa(somme('a_encaisser') + somme('echue'))}</p></div>
        <div className={carte}><p className="text-sm text-gray-500">Dont échu</p><p className={`text-lg font-bold ${somme('echue') ? 'text-red-600' : ''}`}>{fcfa(somme('echue'))}</p></div>
      </div>
      <input className={champ} placeholder="Rechercher un numéro, un client, un objet" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTRES.map((f) => (
          <button key={f} onClick={() => setFiltre(f)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${filtre === f ? 'bg-nuit text-white' : 'bg-white'}`}>
            {f === 'toutes' ? 'Toutes' : LIBELLE_ETAT[f]}
          </button>
        ))}
      </div>
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {affichees.map(({ f, etat }) => (
        <Link key={f.id} to={`/factures/${f.id}`} className={`${carte} block space-y-1`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{f.numero} · {f.client_nom}</p>
              <p className="text-sm text-gray-500">{f.objet}</p>
            </div>
            <BadgeFacture etat={etat} />
          </div>
          <p className="text-sm">
            <b>{fcfa(f.total_ttc)}</b>
            {etat !== 'annulee' && f.reste > 0 && <span className="text-gray-500"> · reste {fcfa(f.reste)}</span>}
            <span className="text-gray-500"> · échéance {dateFr(f.date_echeance)}</span>
          </p>
        </Link>
      ))}
      {!affichees.length && <p className="text-center text-gray-500">Aucune facture.</p>}
    </div>
  )
}
