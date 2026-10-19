import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Progression from '../components/Progression'
import { dateFr } from '../lib/format'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte, champ } from '../lib/ui'
import { LIBELLE_STATUT, type StatutChantier, type StatutChoix } from '../types'

interface Choix { id: string; libelle: string; proposition: string; statut: StatutChoix; commentaire: string | null }
interface Suivi {
  entreprise: { nom: string; telephone: string | null }
  chantier: { titre: string; statut: StatutChantier; avancement: number; date_debut: string | null; date_fin_prevue: string | null }
  historique: { date: string; avancement: number }[]
  choix: Choix[]
}

// Page publique (sans connexion) : accessible uniquement avec le lien secret remis au client.
export default function SuiviClient() {
  const { token = '' } = useParams()
  const [etat, setEtat] = useState<'chargement' | 'introuvable' | 'ok'>('chargement')
  const [suivi, setSuivi] = useState<Suivi | null>(null)
  const [commentaires, setCommentaires] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  const [envoi, setEnvoi] = useState<string | null>(null)

  async function charger() {
    const { data, error } = await supabase.rpc('espace_client_lire', { p_token: token })
    if (error || !data) { setEtat('introuvable'); return }
    setSuivi(data as Suivi)
    setEtat('ok')
  }

  useEffect(() => {
    document.title = 'Suivi de votre chantier'
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    void charger()
    return () => { document.head.removeChild(meta) }
  }, [token])

  async function repondre(c: Choix, statut: 'valide' | 'refuse') {
    setEnvoi(c.id); setMsg('')
    const { data, error } = await supabase.rpc('espace_client_repondre', {
      p_token: token, p_choix: c.id, p_statut: statut, p_commentaire: commentaires[c.id] ?? '',
    })
    setEnvoi(null)
    if (error) return setMsg("Votre réponse n'a pas pu être enregistrée. Réessayez dans un instant.")
    if (data === false) setMsg('Ce choix a déjà reçu une réponse.')
    await charger()
  }

  const page = 'mx-auto min-h-screen max-w-xl space-y-4 p-4'
  const marge = { paddingTop: 'calc(env(safe-area-inset-top) + 16px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }

  if (etat === 'chargement') return <div className={page} style={marge}><p className="text-center text-gray-500">Chargement…</p></div>
  if (etat === 'introuvable' || !suivi) {
    return (
      <div className={page} style={marge}>
        <div className={`${carte} space-y-2 text-center`}>
          <h1 className="text-lg font-bold">Lien introuvable</h1>
          <p className="text-sm text-gray-600">Ce lien de suivi n'existe pas ou n'est plus actif. Contactez votre entreprise pour en obtenir un nouveau.</p>
        </div>
      </div>
    )
  }

  const { entreprise, chantier, historique, choix } = suivi
  const enAttente = choix.filter((c) => c.statut === 'en_attente')

  return (
    <div className={page} style={marge}>
      <p className="text-sm font-semibold text-gray-500">{entreprise.nom}</p>
      <div className={`${carte} space-y-3`}>
        <h1 className="text-xl font-bold">{chantier.titre}</h1>
        <p className="text-sm text-gray-600">{LIBELLE_STATUT[chantier.statut]}</p>
        <Progression pct={chantier.avancement} />
        <p className="text-sm">Avancement : <b>{chantier.avancement} %</b></p>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-gray-500">Début</dt><dd>{dateFr(chantier.date_debut)}</dd></div>
          <div><dt className="text-gray-500">Fin prévue</dt><dd>{dateFr(chantier.date_fin_prevue)}</dd></div>
        </dl>
      </div>

      {choix.length > 0 && (
        <div className={`${carte} space-y-3`}>
          <h2 className="font-bold">Vos choix{enAttente.length ? ` (${enAttente.length} à valider)` : ''}</h2>
          {msg && <p className="text-sm text-red-600">{msg}</p>}
          {choix.map((c) => (
            <div key={c.id} className="space-y-2 border-t border-gray-100 pt-3">
              <p className="font-semibold">{c.libelle}</p>
              <p className="text-sm">{c.proposition}</p>
              {c.statut === 'en_attente' ? (
                <>
                  <input className={champ} placeholder="Un commentaire ? (facultatif)" maxLength={500} value={commentaires[c.id] ?? ''} onChange={(e) => setCommentaires({ ...commentaires, [c.id]: e.target.value })} />
                  <div className="flex gap-2">
                    <button className={btn} disabled={envoi === c.id} onClick={() => void repondre(c, 'valide')}>Je valide</button>
                    <button className={btnSec} disabled={envoi === c.id} onClick={() => void repondre(c, 'refuse')}>Je refuse</button>
                  </div>
                </>
              ) : (
                <p className={`text-sm font-semibold ${c.statut === 'valide' ? 'text-green-700' : 'text-red-700'}`}>
                  {c.statut === 'valide' ? 'Validé' : 'Refusé'}{c.commentaire && <span className="font-normal text-gray-600"> · « {c.commentaire} »</span>}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {historique.length > 0 && (
        <div className={`${carte} space-y-1`}>
          <h2 className="font-bold">Évolution</h2>
          {historique.map((h) => (
            <p key={h.date} className="flex justify-between text-sm"><span className="text-gray-600">{dateFr(h.date)}</span><b>{h.avancement} %</b></p>
          ))}
        </div>
      )}

      {entreprise.telephone && (
        <a className={`${btnSec} block text-center`} href={`tel:${entreprise.telephone.replace(/[^\d+]/g, '')}`}>Appeler {entreprise.nom}</a>
      )}
    </div>
  )
}
