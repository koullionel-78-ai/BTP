import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { aujourdhui, ajouterJours } from '../lib/format'
import { jourCourt } from '../lib/planning'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte, champ, etiquette } from '../lib/ui'
import { lienWhatsApp } from '../lib/whatsapp'
import { LIBELLE_RDV, type RendezVous, type TypeRdv } from '../types'

export interface DevisLimite {
  id: string
  numero: string
  date_limite_envoi: string
  clients?: { nom: string } | null
}

interface ClientChoix { id: string; nom: string; telephone: string | null; adresse: string | null }
interface DevisChoix { id: string; numero: string; objet: string }

interface Props {
  rdvs: RendezVous[]
  devisAEnvoyer: DevisLimite[]
  profils: { id: string; nom: string }[]
  gere: boolean
  indicatif?: string
  onChange: () => void
}

const heureCourte = (h: string | null) => (h ? h.slice(0, 5) : '')

function messageRappel(r: RendezVous): string {
  const nom = r.clients?.nom ?? ''
  const quand = `${jourCourt(r.date_rdv)}${r.heure ? ' à ' + heureCourte(r.heure) : ''}`
  const objet = r.type === 'visite' ? 'notre visite' : r.type === 'metre' ? 'notre rendez-vous pour le métré' : 'notre rendez-vous pour la remise de votre devis'
  return `Bonjour ${nom}, nous vous confirmons ${objet} le ${quand}. À bientôt !`
}

export default function RendezVousDevis({ rdvs, devisAEnvoyer, profils, gere, indicatif, onChange }: Props) {
  const auj = aujourdhui()
  const [ouvert, setOuvert] = useState(false)
  const [clients, setClients] = useState<ClientChoix[]>([])
  const [devisClient, setDevisClient] = useState<DevisChoix[]>([])
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [v, setV] = useState({ type: 'visite' as TypeRdv, date_rdv: ajouterJours(auj, 1), heure: '', client_id: '', devis_id: '', responsable_id: '', adresse: '', notes: '' })

  async function ouvrir() {
    setOuvert(true)
    if (!clients.length) {
      const { data } = await supabase.from('clients').select('id, nom, telephone, adresse').order('nom')
      setClients((data ?? []) as ClientChoix[])
    }
  }

  async function choisirClient(id: string) {
    const c = clients.find((x) => x.id === id)
    setV((x) => ({ ...x, client_id: id, devis_id: '', adresse: c?.adresse ?? '' }))
    setDevisClient([])
    if (!id) return
    const { data } = await supabase.from('devis').select('id, numero, objet').eq('client_id', id).in('statut', ['brouillon', 'envoye']).order('created_at', { ascending: false })
    setDevisClient((data ?? []) as DevisChoix[])
  }

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (!v.client_id) return setErreur('Choisissez un client.')
    setEnvoi(true)
    setErreur('')
    const { error } = await supabase.from('rendez_vous').insert({
      type: v.type,
      date_rdv: v.date_rdv,
      heure: v.heure || null,
      client_id: v.client_id,
      devis_id: v.devis_id || null,
      responsable_id: v.responsable_id || null,
      adresse: v.adresse.trim() || null,
      notes: v.notes.trim() || null,
    })
    setEnvoi(false)
    if (error) return setErreur(error.message)
    setOuvert(false)
    setV({ ...v, client_id: '', devis_id: '', heure: '', adresse: '', notes: '' })
    onChange()
  }

  async function changerStatut(id: string, statut: 'fait' | 'annule') {
    const { error } = await supabase.from('rendez_vous').update({ statut }).eq('id', id)
    if (error) setErreur(error.message)
    onChange()
  }

  async function supprimer(id: string) {
    if (!confirm('Supprimer ce rendez-vous ?')) return
    const { error } = await supabase.from('rendez_vous').delete().eq('id', id)
    if (error) setErreur(error.message)
    onChange()
  }

  const nomDe = (uid: string | null) => profils.find((p) => p.id === uid)?.nom
  const prevus = rdvs
    .filter((r) => r.statut === 'prevu')
    .sort((a, b) => (a.date_rdv + (a.heure ?? '')).localeCompare(b.date_rdv + (b.heure ?? '')))
  const limites = [...devisAEnvoyer].sort((a, b) => a.date_limite_envoi.localeCompare(b.date_limite_envoi))

  if (!gere && !prevus.length) return null

  return (
    <div className={`${carte} space-y-3`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">Devis : rendez-vous et envois</h2>
        {gere && !ouvert && <button className={btnSec} onClick={() => void ouvrir()}>+ Rendez-vous</button>}
      </div>

      {gere && ouvert && (
        <form onSubmit={enregistrer} className="space-y-3 rounded-xl border border-gray-200 p-3">
          <div>
            <label className={etiquette}>Type</label>
            <select className={champ} value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as TypeRdv })}>
              {Object.entries(LIBELLE_RDV).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={etiquette}>Date</label><input className={champ} type="date" value={v.date_rdv} onChange={(e) => setV({ ...v, date_rdv: e.target.value })} required /></div>
            <div><label className={etiquette}>Heure</label><input className={champ} type="time" value={v.heure} onChange={(e) => setV({ ...v, heure: e.target.value })} /></div>
          </div>
          <div>
            <label className={etiquette}>Client</label>
            <select className={champ} value={v.client_id} onChange={(e) => void choisirClient(e.target.value)} required>
              <option value="">Choisir un client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          {devisClient.length > 0 && (
            <div>
              <label className={etiquette}>Devis concerné (facultatif)</label>
              <select className={champ} value={v.devis_id} onChange={(e) => setV({ ...v, devis_id: e.target.value })}>
                <option value="">Aucun</option>
                {devisClient.map((d) => <option key={d.id} value={d.id}>{d.numero} · {d.objet}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className={etiquette}>Responsable (facultatif)</label>
            <select className={champ} value={v.responsable_id} onChange={(e) => setV({ ...v, responsable_id: e.target.value })}>
              <option value="">Personne pour l'instant</option>
              {profils.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </div>
          <div><label className={etiquette}>Adresse</label><input className={champ} value={v.adresse} onChange={(e) => setV({ ...v, adresse: e.target.value })} /></div>
          <div><label className={etiquette}>Notes</label><textarea className={champ} rows={2} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></div>
          {erreur && <p className="text-sm text-red-600">{erreur}</p>}
          <div className="flex gap-2">
            <button className={btn} disabled={envoi}>{envoi ? 'Patientez…' : 'Enregistrer'}</button>
            <button type="button" className={btnSec} onClick={() => setOuvert(false)}>Annuler</button>
          </div>
        </form>
      )}
      {!ouvert && erreur && <p className="text-sm text-red-600">{erreur}</p>}

      {limites.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-600">Devis à envoyer</p>
          {limites.map((d) => (
            <Link key={d.id} to={`/devis/${d.id}`} className="flex items-center justify-between border-t border-gray-100 pt-2 text-sm">
              <span>{d.numero} · {d.clients?.nom ?? 'Client'}</span>
              <b className={d.date_limite_envoi < auj ? 'text-red-600' : d.date_limite_envoi === auj ? 'text-orange-600' : ''}>
                {d.date_limite_envoi < auj ? 'En retard · ' : ''}{jourCourt(d.date_limite_envoi)}
              </b>
            </Link>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-600">Rendez-vous prévus ({prevus.length})</p>
        {prevus.map((r) => {
          const enRetard = r.date_rdv < auj
          return (
            <div key={r.id} className="space-y-1 border-t border-gray-100 pt-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{jourCourt(r.date_rdv)}{r.heure ? ` · ${heureCourte(r.heure)}` : ''} · {LIBELLE_RDV[r.type]}</p>
                  <p>{r.clients?.nom ?? 'Client'}{nomDe(r.responsable_id) ? ` · ${nomDe(r.responsable_id)}` : ' · responsable à trouver'}</p>
                  {r.adresse && <p className="text-gray-500">{r.adresse}</p>}
                  {r.notes && <p className="text-gray-500">{r.notes}</p>}
                </div>
                {enRetard && <span className="whitespace-nowrap rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">À clôturer</span>}
              </div>
              {gere && (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <button className="underline" onClick={() => void changerStatut(r.id, 'fait')}>Fait</button>
                  <button className="underline" onClick={() => void changerStatut(r.id, 'annule')}>Annuler</button>
                  {r.clients?.telephone && (
                    <a className="underline" href={lienWhatsApp(r.clients.telephone, messageRappel(r), indicatif)} target="_blank" rel="noreferrer">Rappel WhatsApp</a>
                  )}
                  {r.type !== 'remise' && !r.devis_id && <Link className="underline" to={`/devis/nouveau?client=${r.client_id}`}>Créer le devis</Link>}
                  {r.devis_id && <Link className="underline" to={`/devis/${r.devis_id}`}>Voir le devis</Link>}
                  <button className="text-red-600" onClick={() => void supprimer(r.id)}>Supprimer</button>
                </div>
              )}
            </div>
          )
        })}
        {!prevus.length && <p className="text-sm text-gray-500">Aucun rendez-vous prévu.</p>}
      </div>
    </div>
  )

}
