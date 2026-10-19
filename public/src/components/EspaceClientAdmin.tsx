import { useEffect, useState, type FormEvent } from 'react'
import { dateFr } from '../lib/format'
import { supabase } from '../lib/supabase'
import { lienWhatsApp } from '../lib/whatsapp'
import { btn, btnSec, carte, champ, etiquette } from '../lib/ui'
import type { ChoixClient, StatutChoix } from '../types'

interface Espace { id: string; token: string; actif: boolean }
interface Props { chantierId: string; titre: string; clientNom?: string | null; clientTel?: string | null; indicatif?: string }

const LIBELLE: Record<StatutChoix, { texte: string; style: string }> = {
  en_attente: { texte: 'En attente', style: 'bg-orange-100 text-orange-700' },
  valide: { texte: 'Validé', style: 'bg-green-100 text-green-700' },
  refuse: { texte: 'Refusé', style: 'bg-red-100 text-red-700' },
}

// Lien de suivi à envoyer au client (sans compte) + choix (couleurs, matériaux) qu'il valide depuis son téléphone.
export default function EspaceClientAdmin({ chantierId, titre, clientNom, clientTel, indicatif }: Props) {
  const [espace, setEspace] = useState<Espace | null>(null)
  const [choix, setChoix] = useState<ChoixClient[]>([])
  const [libelle, setLibelle] = useState('')
  const [proposition, setProposition] = useState('')
  const [msg, setMsg] = useState('')
  const [copie, setCopie] = useState(false)

  async function charger() {
    const [e, c] = await Promise.all([
      supabase.from('espaces_client').select('id, token, actif').eq('chantier_id', chantierId).maybeSingle(),
      supabase.from('choix_client').select('*').eq('chantier_id', chantierId).order('created_at'),
    ])
    setEspace((e.data as Espace | null) ?? null)
    setChoix((c.data ?? []) as ChoixClient[])
  }
  useEffect(() => { void charger() }, [chantierId])

  const lien = espace ? `${window.location.origin}/suivi/${espace.token}` : ''
  const message = `Bonjour${clientNom ? ' ' + clientNom : ''}, suivez l'avancement de votre chantier « ${titre} » et validez vos choix ici : ${lien}`

  async function creer() {
    const { error } = await supabase.from('espaces_client').insert({ chantier_id: chantierId })
    setMsg(error ? error.message : '')
    await charger()
  }

  async function basculer() {
    if (!espace) return
    const { error } = await supabase.from('espaces_client').update({ actif: !espace.actif }).eq('id', espace.id)
    setMsg(error ? error.message : '')
    await charger()
  }

  async function regenerer() {
    if (!espace || !confirm("Créer un nouveau lien ? L'ancien lien cessera immédiatement de fonctionner.")) return
    const d = await supabase.from('espaces_client').delete().eq('id', espace.id)
    if (d.error) return setMsg(d.error.message)
    await creer()
  }

  async function copier() {
    try { await navigator.clipboard.writeText(lien); setCopie(true); setTimeout(() => setCopie(false), 2000) }
    catch { setMsg('Copie impossible : sélectionnez le lien et copiez-le à la main.') }
  }

  async function ajouterChoix(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('choix_client').insert({ chantier_id: chantierId, libelle: libelle.trim(), proposition: proposition.trim() })
    if (error) return setMsg(error.message)
    setLibelle(''); setProposition(''); setMsg('')
    await charger()
  }

  async function redemander(c: ChoixClient) {
    const { error } = await supabase.from('choix_client').update({ statut: 'en_attente', commentaire_client: null, repondu_le: null }).eq('id', c.id)
    setMsg(error ? error.message : '')
    await charger()
  }

  async function supprimerChoix(c: ChoixClient) {
    if (!confirm(`Supprimer « ${c.libelle} » ?`)) return
    const { error } = await supabase.from('choix_client').delete().eq('id', c.id)
    setMsg(error ? error.message : '')
    await charger()
  }

  return (
    <div className={`${carte} space-y-3`}>
      <h2 className="font-bold">Espace client</h2>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      {!espace ? (
        <>
          <p className="text-sm text-gray-600">Donnez au client un lien pour suivre l'avancement et valider ses choix de couleurs et de matériaux, sans créer de compte.</p>
          <button className={btn} onClick={() => void creer()}>Créer le lien de suivi</button>
        </>
      ) : (
        <>
          <p className={`break-all rounded-lg bg-gray-50 p-2 text-xs ${espace.actif ? '' : 'text-gray-400 line-through'}`}>{lien}</p>
          {!espace.actif && <p className="text-sm text-orange-700">Lien désactivé : le client ne peut plus le consulter.</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button className={btnSec} onClick={() => void copier()}>{copie ? 'Copié' : 'Copier le lien'}</button>
            <a className={btn} href={lienWhatsApp(clientTel, message, indicatif)} target="_blank" rel="noreferrer">Envoyer par WhatsApp</a>
          </div>
          <div className="flex gap-4 text-sm">
            <button className="underline" onClick={() => void basculer()}>{espace.actif ? 'Désactiver le lien' : 'Réactiver le lien'}</button>
            <button className="text-red-600 underline" onClick={() => void regenerer()}>Nouveau lien</button>
          </div>
          <p className="text-xs text-gray-500">Le client voit l'avancement, les dates prévues et ses choix. Il ne voit ni les montants, ni les photos, ni les rapports détaillés. Toute personne qui a le lien y a accès : envoyez-le uniquement au client.</p>

          <h3 className="pt-1 font-semibold">Choix à valider ({choix.length})</h3>
          {choix.map((c) => (
            <div key={c.id} className="space-y-1 border-t border-gray-100 pt-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p><b>{c.libelle}</b> : {c.proposition}</p>
                <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${LIBELLE[c.statut].style}`}>{LIBELLE[c.statut].texte}</span>
              </div>
              {c.commentaire_client && <p className="text-gray-600">« {c.commentaire_client} »</p>}
              {c.repondu_le && <p className="text-xs text-gray-500">Réponse du {dateFr(c.repondu_le.slice(0, 10))}</p>}
              <div className="flex gap-4">
                {c.statut !== 'en_attente' && <button className="underline" onClick={() => void redemander(c)}>Redemander</button>}
                <button className="text-red-600" onClick={() => void supprimerChoix(c)}>Supprimer</button>
              </div>
            </div>
          ))}
          <form onSubmit={ajouterChoix} className="space-y-2 rounded-lg bg-gray-50 p-3">
            <div><label className={etiquette}>Sujet</label><input className={champ} value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Ex. Couleur du salon" required /></div>
            <div><label className={etiquette}>Proposition</label><input className={champ} value={proposition} onChange={(e) => setProposition(e.target.value)} placeholder="Ex. Blanc cassé, réf. B12" required /></div>
            <button className={btnSec}>Ajouter un choix</button>
          </form>
        </>
      )}
    </div>
  )
}
