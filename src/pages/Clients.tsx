import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import ClientForm, { type ClientSaisie } from '../components/ClientForm'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte, champ } from '../lib/ui'
import { peutGerer, type Client } from '../types'

export default function Clients() {
  const { profil } = useAuth()
  const nav = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [q, setQ] = useState('')
  const [nouveau, setNouveau] = useState(false)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    supabase.from('clients').select('*').order('nom').then(({ data, error }) => {
      if (error) setErreur(error.message)
      else setClients(data as Client[])
    })
  }, [])

  if (!profil || profil.role === 'ouvrier') return <p className={carte}>Accès non autorisé.</p>

  async function creer(v: ClientSaisie) {
    const { data, error } = await supabase.from('clients').insert(v).select('id').single()
    if (error) return error.message
    nav(`/clients/${data.id}`)
    return null
  }

  const filtres = clients.filter(
    (c) => c.nom.toLowerCase().includes(q.toLowerCase()) || (c.telephone ?? '').includes(q),
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Clients ({clients.length})</h1>
        {peutGerer(profil.role) && (
          <button className={nouveau ? btnSec : btn} onClick={() => setNouveau(!nouveau)}>
            {nouveau ? 'Annuler' : 'Nouveau client'}
          </button>
        )}
      </div>
      {nouveau && <div className={carte}><ClientForm libelle="Créer le client" onSubmit={creer} /></div>}
      <input className={champ} placeholder="Rechercher un nom ou un téléphone" value={q} onChange={(e) => setQ(e.target.value)} />
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {filtres.map((c) => (
        <Link key={c.id} to={`/clients/${c.id}`} className={`${carte} block`}>
          <p className="font-semibold">{c.nom}</p>
          <p className="text-sm text-gray-500">{c.telephone ?? 'Pas de téléphone'}</p>
        </Link>
      ))}
      {!filtres.length && <p className="text-center text-gray-500">Aucun client.</p>}
    </div>
  )
}
