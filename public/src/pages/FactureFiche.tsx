import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { BadgeFacture } from '../components/BadgeDoc'
import BoutonWhatsApp from '../components/BoutonWhatsApp'
import DocumentView from '../components/DocumentView'
import { dateFr, fcfa } from '../lib/format'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte, champ, etiquette } from '../lib/ui'
import { etatFacture, LIBELLE_MODE, peutGerer, type Client, type Entreprise, type Facture, type Ligne, type ModePaiement, type Paiement } from '../types'

export default function FactureFiche() {
  const { id = '' } = useParams()
  const { profil } = useAuth()
  const [facture, setFacture] = useState<Facture | null>(null)
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null)
  const [introuvable, setIntrouvable] = useState(false)
  const [montant, setMontant] = useState('')
  const [mode, setMode] = useState<ModePaiement>('especes')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')
  const [msg, setMsg] = useState('')

  async function charger() {
    const { data: f } = await supabase.from('factures_totaux').select('*').eq('id', id).maybeSingle()
    if (!f) return setIntrouvable(true)
    const fa = f as Facture
    setFacture(fa)
    const [l, p, c, e] = await Promise.all([
      supabase.from('lignes_facture').select('*').eq('facture_id', id).order('position'),
      supabase.from('paiements').select('*').eq('facture_id', id).order('date_paiement'),
      supabase.from('clients').select('*').eq('id', fa.client_id).maybeSingle(),
      supabase.from('entreprise').select('*').eq('id', 1).maybeSingle(),
    ])
    setLignes((l.data ?? []) as Ligne[])
    setPaiements((p.data ?? []) as Paiement[])
    setClient(c.data as Client | null)
    setEntreprise(e.data as Entreprise | null)
  }
  useEffect(() => { void charger() }, [id])

  if (!peutGerer(profil?.role)) return <p className={carte}>Accès non autorisé.</p>
  if (introuvable) return <p className={carte}>Facture introuvable.</p>
  if (!facture) return <p className="text-center text-gray-500">Chargement…</p>

  const etat = etatFacture(facture)
  const peutEncaisser = facture.statut === 'emise' && facture.reste > 0

  async function encaisser(e: FormEvent) {
    e.preventDefault()
    const m = Math.round(Number(montant.replace(',', '.')))
    if (!m || m <= 0) return setMsg('Saisissez un montant valide.')
    if (m > (facture?.reste ?? 0)) return setMsg(`Le montant dépasse le reste à payer (${fcfa(facture?.reste ?? 0)}).`)
    const { error } = await supabase.from('paiements').insert({
      facture_id: id, montant: m, mode, date_paiement: date, reference: reference.trim() || null,
    })
    if (error) return setMsg(error.message)
    setMsg('')
    setMontant('')
    setReference('')
    await charger()
  }

  async function supprimerPaiement(p: Paiement) {
    if (!confirm(`Supprimer le paiement de ${fcfa(p.montant)} ?`)) return
    const { error } = await supabase.from('paiements').delete().eq('id', p.id)
    setMsg(error ? error.message : '')
    await charger()
  }

  async function annuler() {
    if (!confirm('Annuler cette facture ? Elle ne comptera plus dans les impayés.')) return
    const { error } = await supabase.from('factures').update({ statut: 'annulee' }).eq('id', id)
    setMsg(error ? error.message : '')
    await charger()
  }

  async function reactiver() {
    const { error } = await supabase.from('factures').update({ statut: 'emise' }).eq('id', id)
    setMsg(error ? error.message : '')
    await charger()
  }

  return (
    <div className="space-y-3">
      <div className="no-print space-y-3">
        <Link to="/factures" className="text-sm underline">← Factures</Link>
        <div className={`${carte} space-y-3`}>
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold">{facture.numero}</p>
            <BadgeFacture etat={etat} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={btn} onClick={() => window.print()}>Imprimer / PDF</button>
            {facture.statut !== 'annulee' && (
              <BoutonWhatsApp
                telephone={client?.telephone}
                indicatif={entreprise?.indicatif_pays}
                libelle={etat === 'echue' ? 'Relancer par WhatsApp' : 'Envoyer par WhatsApp'}
                texte={etat === 'echue'
                  ? `Bonjour${client ? ' ' + client.nom : ''},\nsauf erreur de notre part, la facture ${facture.numero} (échéance du ${dateFr(facture.date_echeance)}) reste à régler : ${fcfa(facture.reste)}.\nMerci d'avance.\n${entreprise?.nom ?? ''}`
                  : `Bonjour${client ? ' ' + client.nom : ''},\nVoici votre facture ${facture.numero} d'un montant de ${fcfa(facture.total_ttc)}${facture.reste > 0 ? `, à régler avant le ${dateFr(facture.date_echeance)}` : ''}.\n${entreprise?.nom ?? ''}`}
              />
            )}
            {facture.statut === 'emise' && facture.paye === 0 && <Link to={`/factures/${id}/modifier`} className={btnSec}>Modifier</Link>}
            {facture.devis_id && <Link to={`/devis/${facture.devis_id}`} className={btnSec}>Voir le devis</Link>}
          </div>
          {msg && <p className="text-sm text-red-600">{msg}</p>}
        </div>

        <div className={`${carte} space-y-3`}>
          <h2 className="font-bold">Paiements</h2>
          <p className="text-sm">Payé : <b>{fcfa(facture.paye)}</b> sur {fcfa(facture.total_ttc)} · reste <b>{fcfa(facture.reste)}</b></p>
          {paiements.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-t border-gray-100 pt-2 text-sm">
              <span>{dateFr(p.date_paiement)} · {LIBELLE_MODE[p.mode]}{p.reference ? ` · ${p.reference}` : ''}</span>
              <span className="flex items-center gap-3">
                <b>{fcfa(p.montant)}</b>
                <button className="text-red-600" onClick={() => void supprimerPaiement(p)}>Supprimer</button>
              </span>
            </div>
          ))}
          {!paiements.length && <p className="text-sm text-gray-500">Aucun paiement enregistré.</p>}
          {peutEncaisser && (
            <form onSubmit={encaisser} className="space-y-2 border-t border-gray-100 pt-3">
              <div className="grid grid-cols-2 gap-2">
                <div><label className={etiquette}>Montant (FCFA)</label><input className={champ} inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder={String(facture.reste)} required /></div>
                <div><label className={etiquette}>Date</label><input className={champ} type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={etiquette}>Mode</label>
                  <select className={champ} value={mode} onChange={(e) => setMode(e.target.value as ModePaiement)}>
                    {Object.entries(LIBELLE_MODE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </div>
                <div><label className={etiquette}>Référence</label><input className={champ} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° de transaction" /></div>
              </div>
              <div className="flex gap-2">
                <button className={btn}>Enregistrer le paiement</button>
                <button type="button" className={btnSec} onClick={() => setMontant(String(facture.reste))}>Solde complet</button>
              </div>
            </form>
          )}
        </div>

        {facture.statut === 'emise' && facture.paye === 0 && <button className="text-sm text-red-600" onClick={() => void annuler()}>Annuler la facture</button>}
        {facture.statut === 'annulee' && <button className="text-sm underline" onClick={() => void reactiver()}>Réactiver la facture</button>}
      </div>
      <DocumentView type="facture" doc={facture} lignes={lignes} client={client} entreprise={entreprise} paiements={paiements} />
    </div>
  )
}
