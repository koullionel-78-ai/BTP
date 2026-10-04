import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Badge from '../components/Badge'
import ClientForm, { type ClientSaisie } from '../components/ClientForm'
import { supabase } from '../lib/supabase'
import { btnSec, carte } from '../lib/ui'
import { peutGerer, type Chantier, type Client } from '../types'

export default function ClientFiche() {
  const { id = '' } = useParams()
  const { profil } = useAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [ok, setOk] = useState('')

  useEffect(() => {
    supabase.from('clients').select('*').eq('id', id).maybeSingle().then(({ data }) => setClient(data as Client | null))
    supabase.from('chantiers').select('*').eq('client_id', id).order('created_at', { ascending: false })
      .then(({ data }) => setChantiers((data ?? []) as Chantier[]))
  }, [id])

  async function enregistrer(v: ClientSaisie) {
    const { error } = await supabase.from('clients').update(v).eq('id', id)
    setOk(error ? '' : 'Modifications enregistrées.')
    return error ? error.message : null
  }

  if (!client) return <p className="text-center text-gray-500">Chargement…</p>

  return (
    <div className="space-y-4">
      <Link to="/clients" className="text-sm underline">← Clients</Link>
      <h1 className="text-xl font-bold">{client.nom}</h1>
      <div className={carte}>
        <ClientForm initial={client} libelle="Enregistrer" desactive={!peutGerer(profil?.role)} onSubmit={enregistrer} />
        {ok && <p className="mt-2 text-sm text-green-700">{ok}</p>}
      </div>
      <h2 className="font-bold">Chantiers du client</h2>
      {chantiers.map((c) => (
        <Link key={c.id} to={`/chantiers/${c.id}`} className={`${carte} flex items-center justify-between`}>
          <span className="font-semibold">{c.titre}</span>
          <Badge statut={c.statut} />
        </Link>
      ))}
      {!chantiers.length && <p className="text-gray-500">Aucun chantier pour ce client.</p>}
      {peutGerer(profil?.role) && (
        <div className="flex gap-2">
          <Link to={`/devis/nouveau?client=${id}`} className={btnSec}>Nouveau devis</Link>
          <Link to={`/factures/nouvelle?client=${id}`} className={btnSec}>Nouvelle facture</Link>
        </div>
      )}
    </div>
  )
}
