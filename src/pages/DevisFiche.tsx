import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { BadgeDevis } from '../components/BadgeDoc'
import BoutonWhatsApp from '../components/BoutonWhatsApp'
import DocumentView from '../components/DocumentView'
import { fcfa } from '../lib/format'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte } from '../lib/ui'
import { LIBELLE_DEVIS, peutGerer, type Client, type Devis, type Entreprise, type Ligne, type StatutDevis } from '../types'

export default function DevisFiche() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { profil } = useAuth()
  const [devis, setDevis] = useState<Devis | null>(null)
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null)
  const [factureId, setFactureId] = useState<string | null>(null)
  const [introuvable, setIntrouvable] = useState(false)
  const [msg, setMsg] = useState('')

  async function charger() {
    const { data: d } = await supabase.from('devis_totaux').select('*').eq('id', id).maybeSingle()
    if (!d) return setIntrouvable(true)
    const dv = d as Devis
    setDevis(dv)
    const [l, c, e, f] = await Promise.all([
      supabase.from('lignes_devis').select('*').eq('devis_id', id).order('position'),
      supabase.from('clients').select('*').eq('id', dv.client_id).maybeSingle(),
      supabase.from('entreprise').select('*').eq('id', 1).maybeSingle(),
      supabase.from('factures').select('id').eq('devis_id', id).neq('statut', 'annulee').limit(1),
    ])
    setLignes((l.data ?? []) as Ligne[])
    setClient(c.data as Client | null)
    setEntreprise(e.data as Entreprise | null)
    setFactureId(f.data?.[0]?.id ?? null)
  }
  useEffect(() => { void charger() }, [id])

  if (!peutGerer(profil?.role)) return <p className={carte}>Accès non autorisé.</p>
  if (introuvable) return <p className={carte}>Devis introuvable.</p>
  if (!devis) return <p className="text-center text-gray-500">Chargement…</p>

  async function changerStatut(statut: StatutDevis) {
    const { error } = await supabase.from('devis').update({ statut }).eq('id', id)
    setMsg(error ? error.message : '')
    await charger()
  }

  async function facturer() {
    setMsg('')
    const { data, error } = await supabase.rpc('facturer_devis', { p_devis: id })
    if (error) return setMsg(error.message)
    nav(`/factures/${data as string}`)
  }

  async function supprimer() {
    if (!confirm('Supprimer ce devis ?')) return
    const { error } = await supabase.from('devis').delete().eq('id', id)
    if (error) return setMsg(error.message)
    nav('/devis')
  }

  const modifiable = devis.statut !== 'accepte'

  return (
    <div className="space-y-3">
      <div className="no-print space-y-3">
        <Link to="/devis" className="text-sm underline">← Devis</Link>
        <div className={`${carte} space-y-3`}>
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold">{devis.numero}</p>
            <BadgeDevis statut={devis.statut} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={btn} onClick={() => window.print()}>Imprimer / PDF</button>
            <BoutonWhatsApp
              telephone={client?.telephone}
              indicatif={entreprise?.indicatif_pays}
              texte={`Bonjour${client ? ' ' + client.nom : ''},\nVoici notre devis ${devis.numero} d'un montant de ${fcfa(devis.total_ttc)}, valable ${devis.validite_jours} jours.\n${entreprise?.nom ?? ''}`}
            />
            {modifiable && <Link to={`/devis/${id}/modifier`} className={btnSec}>Modifier</Link>}
            {devis.statut === 'accepte' && !factureId && <button className={btn} onClick={() => void facturer()}>Créer la facture</button>}
            {factureId && <Link to={`/factures/${factureId}`} className={btnSec}>Voir la facture</Link>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-600">Statut du devis</label>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"
              value={devis.statut}
              disabled={!!factureId}
              onChange={(e) => void changerStatut(e.target.value as StatutDevis)}
            >
              {Object.entries(LIBELLE_DEVIS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            {factureId && <p className="mt-1 text-xs text-gray-500">Le devis est facturé : son statut est verrouillé.</p>}
          </div>
          <p className="text-xs text-gray-500">Pour joindre le PDF : « Imprimer / PDF », enregistrez-le, puis ajoutez-le dans la conversation WhatsApp.</p>
          {msg && <p className="text-sm text-red-600">{msg}</p>}
          {modifiable && !factureId && <button className="text-sm text-red-600" onClick={() => void supprimer()}>Supprimer le devis</button>}
        </div>
      </div>
      <DocumentView type="devis" doc={devis} lignes={lignes} client={client} entreprise={entreprise} />
    </div>
  )
}
