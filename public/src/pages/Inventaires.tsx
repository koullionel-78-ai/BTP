import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { dateFr } from '../lib/format'
import { supabase } from '../lib/supabase'
import { btn, carte, champ } from '../lib/ui'
import { peutGerer, type Inventaire } from '../types'

export default function Inventaires() {
  const { profil } = useAuth()
  const nav = useNavigate()
  const [liste, setListe] = useState<Inventaire[]>([])
  const [note, setNote] = useState('')
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => {
    supabase.from('inventaires').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) setErreur(error.message)
      else setListe(data as Inventaire[])
    })
  }, [])

  if (!peutGerer(profil?.role)) return <p className={carte}>Accès non autorisé.</p>

  const ouvert = liste.find((i) => i.statut === 'en_cours')

  async function demarrer() {
    setEnvoi(true)
    setErreur('')
    const { data, error } = await supabase.rpc('demarrer_inventaire', { p_note: note })
    setEnvoi(false)
    if (error) return setErreur(error.message)
    nav(`/inventaires/${data as string}`)
  }

  return (
    <div className="space-y-3">
      <Link to="/stock" className="text-sm underline">← Stock</Link>
      <h1 className="text-xl font-bold">Inventaires</h1>

      {ouvert ? (
        <Link to={`/inventaires/${ouvert.id}`} className={`${carte} block border border-orange-200 bg-orange-50`}>
          <p className="font-semibold text-orange-800">Inventaire en cours depuis le {dateFr(ouvert.date_inventaire)}</p>
          <p className="text-sm underline">Reprendre le comptage</p>
        </Link>
      ) : (
        <div className={`${carte} space-y-2`}>
          <p className="text-sm text-gray-600">Le stock théorique de tous les articles est figé au démarrage. Vous saisissez ensuite les quantités réellement comptées.</p>
          <input className={champ} placeholder="Note (facultatif), ex. Inventaire de fin de mois" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className={btn} onClick={() => void demarrer()} disabled={envoi}>{envoi ? 'Patientez…' : 'Démarrer un inventaire'}</button>
        </div>
      )}
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

      {liste.filter((i) => i.statut === 'valide').map((i) => (
        <Link key={i.id} to={`/inventaires/${i.id}`} className={`${carte} flex items-center justify-between`}>
          <div>
            <p className="font-semibold">Inventaire du {dateFr(i.date_inventaire)}</p>
            {i.note && <p className="text-sm text-gray-500">{i.note}</p>}
          </div>
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">Validé</span>
        </Link>
      ))}
      {!liste.length && <p className="text-center text-gray-500">Aucun inventaire.</p>}
    </div>
  )
}
