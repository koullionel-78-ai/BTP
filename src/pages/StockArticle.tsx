import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import ArticleForm, { messageArticle, type ArticleSaisie } from '../components/ArticleForm'
import { aujourdhui, dateFr, fcfa, qte } from '../lib/format'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte, champ, etiquette } from '../lib/ui'
import { LIBELLE_MOUVEMENT, peutGerer, type ArticleStock, type Mouvement } from '../types'

interface ChantierChoix { id: string; titre: string }

export default function StockArticle() {
  const { id = '' } = useParams()
  const { profil } = useAuth()
  const gere = peutGerer(profil?.role)
  const [a, setA] = useState<ArticleStock | null>(null)
  const [mouvements, setMouvements] = useState<Mouvement[]>([])
  const [chantiers, setChantiers] = useState<ChantierChoix[]>([])
  const [introuvable, setIntrouvable] = useState(false)
  const [mode, setMode] = useState<'sortie' | 'entree'>('sortie')
  const [quantite, setQuantite] = useState('')
  const [chantierId, setChantierId] = useState('')
  const [date, setDate] = useState(aujourdhui())
  const [note, setNote] = useState('')
  const [modifier, setModifier] = useState(false)
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState('')

  async function charger() {
    const [s, m, c] = await Promise.all([
      supabase.from('articles_stock').select('*').eq('id', id).maybeSingle(),
      supabase.from('mouvements_stock').select('*, chantiers(titre), profils(nom)').eq('article_id', id)
        .order('date_mouvement', { ascending: false }).order('created_at', { ascending: false }).limit(50),
      supabase.from('chantiers').select('id, titre').in('statut', ['a_planifier', 'en_cours', 'en_pause']).order('titre'),
    ])
    if (!s.data) return setIntrouvable(true)
    setA(s.data as ArticleStock)
    setMouvements((m.data ?? []) as Mouvement[])
    setChantiers((c.data ?? []) as ChantierChoix[])
  }
  useEffect(() => { void charger() }, [id])

  useEffect(() => { if (!gere) setMode('sortie') }, [gere])

  if (!profil || !(gere || profil.role === 'chef_chantier')) return <p className={carte}>Accès non autorisé.</p>
  if (introuvable) return <p className={carte}>Article introuvable.</p>
  if (!a) return <p className="text-center text-gray-500">Chargement…</p>

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    setOk('')
    const n = Number(quantite.replace(',', '.'))
    if (!Number.isFinite(n) || n <= 0) return setMsg('Saisissez une quantité supérieure à 0.')
    if (mode === 'sortie' && !chantierId) return setMsg('Choisissez le chantier qui reçoit le matériel.')
    if (mode === 'sortie' && n > (a?.quantite ?? 0)) return setMsg(`Stock insuffisant (disponible : ${qte(a?.quantite ?? 0)} ${a?.unite}).`)
    const { error } = await supabase.from('mouvements_stock').insert({
      article_id: id,
      type: mode,
      quantite: mode === 'sortie' ? -n : n,
      chantier_id: mode === 'sortie' ? chantierId : null,
      date_mouvement: date,
      note: note.trim() || null,
    })
    if (error) return setMsg(error.message)
    setMsg('')
    setQuantite('')
    setNote('')
    setOk(mode === 'sortie' ? 'Sortie enregistrée.' : 'Entrée enregistrée.')
    await charger()
  }

  async function majArticle(v: ArticleSaisie) {
    const { error } = await supabase.from('articles').update(v).eq('id', id)
    if (error) return messageArticle(error)
    setModifier(false)
    await charger()
    return null
  }

  async function archiver() {
    if (!confirm('Archiver cet article ? Il disparaît du stock et des inventaires (son historique est conservé).')) return
    const { error } = await supabase.from('articles').update({ actif: false }).eq('id', id)
    if (error) return setMsg(error.message)
    await charger()
  }

  return (
    <div className="space-y-3">
      <Link to="/stock" className="text-sm underline">← Stock</Link>
      <div className={`${carte} space-y-2`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">{a.nom}</h1>
            <p className="text-sm text-gray-500">{a.categorie ?? 'Sans catégorie'}{!a.actif && ' · archivé'}</p>
          </div>
          {a.en_alerte && <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">Stock bas</span>}
        </div>
        <p className={`text-3xl font-bold ${a.quantite < 0 ? 'text-red-600' : ''}`}>{qte(a.quantite)} <span className="text-base font-normal text-gray-500">{a.unite}</span></p>
        <p className="text-sm text-gray-500">
          {a.seuil_alerte > 0 ? `Alerte à ${qte(a.seuil_alerte)} ${a.unite}` : "Pas de seuil d'alerte"}
          {gere && ` · achat ${fcfa(a.prix_unitaire)} / ${a.unite}`}
        </p>
        {gere && a.actif && (
          <div className="flex gap-3 pt-1">
            <button className={btnSec} onClick={() => setModifier(!modifier)}>{modifier ? 'Fermer' : 'Modifier'}</button>
            <button className="text-sm text-red-600" onClick={() => void archiver()}>Archiver</button>
          </div>
        )}
        {modifier && (
          <div className="border-t border-gray-100 pt-3">
            <ArticleForm libelle="Enregistrer" initial={{ nom: a.nom, categorie: a.categorie, unite: a.unite, seuil_alerte: a.seuil_alerte, prix_unitaire: a.prix_unitaire }} onSubmit={majArticle} />
          </div>
        )}
      </div>

      {a.actif && (
        <form onSubmit={enregistrer} className={`${carte} space-y-3`}>
          {gere ? (
            <div className="flex gap-2">
              {(['sortie', 'entree'] as const).map((m) => (
                <button type="button" key={m} onClick={() => { setMode(m); setMsg(''); setOk('') }}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold ${mode === m ? 'bg-nuit text-white' : 'bg-gray-100'}`}>
                  {m === 'sortie' ? 'Sortie vers un chantier' : 'Entrée en stock'}
                </button>
              ))}
            </div>
          ) : <h2 className="font-bold">Sortie vers un chantier</h2>}
          <div className="grid grid-cols-2 gap-2">
            <div><label className={etiquette}>Quantité ({a.unite})</label><input className={champ} inputMode="decimal" value={quantite} onChange={(e) => setQuantite(e.target.value)} required /></div>
            <div><label className={etiquette}>Date</label><input className={champ} type="date" value={date} max={aujourdhui()} onChange={(e) => setDate(e.target.value)} required /></div>
          </div>
          {mode === 'sortie' && (
            <div>
              <label className={etiquette}>Chantier</label>
              <select className={champ} value={chantierId} onChange={(e) => setChantierId(e.target.value)} required>
                <option value="">Choisir un chantier…</option>
                {chantiers.map((c) => <option key={c.id} value={c.id}>{c.titre}</option>)}
              </select>
              {!chantiers.length && <p className="mt-1 text-xs text-gray-500">Aucun chantier disponible pour vous.</p>}
            </div>
          )}
          <div><label className={etiquette}>Note (facultatif)</label><input className={champ} value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === 'entree' ? 'Ex. Achat fournisseur, facture n°…' : 'Ex. Pour le salon'} /></div>
          {msg && <p className="text-sm text-red-600">{msg}</p>}
          {ok && <p className="text-sm text-green-700">{ok}</p>}
          <button className={btn}>{mode === 'sortie' ? 'Enregistrer la sortie' : "Enregistrer l'entrée"}</button>
        </form>
      )}

      <div className={`${carte} space-y-2`}>
        <h2 className="font-bold">Historique</h2>
        {mouvements.map((m) => (
          <div key={m.id} className="flex items-start justify-between gap-2 border-t border-gray-100 pt-2 text-sm">
            <div>
              <p className="font-semibold">{LIBELLE_MOUVEMENT[m.type]}{m.chantiers?.titre ? ` · ${m.chantiers.titre}` : ''}</p>
              <p className="text-gray-500">{dateFr(m.date_mouvement)}{m.profils?.nom ? ` · ${m.profils.nom}` : ''}{m.note ? ` · ${m.note}` : ''}</p>
            </div>
            <b className={m.quantite > 0 ? 'text-green-700' : 'text-red-600'}>{m.quantite > 0 ? '+' : ''}{qte(m.quantite)}</b>
          </div>
        ))}
        {!mouvements.length && <p className="text-sm text-gray-500">Aucun mouvement.</p>}
        {mouvements.length === 50 && <p className="text-xs text-gray-500">Les 50 mouvements les plus récents.</p>}
      </div>
    </div>
  )
}
