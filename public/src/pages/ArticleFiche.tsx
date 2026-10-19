import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import ArticleForm, { type ArticleSaisie } from '../components/ArticleForm'
import { dateFr } from '../lib/format'
import { nombre, qte } from '../lib/stock'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte, champ, etiquette } from '../lib/ui'
import { LIBELLE_CATEGORIE, LIBELLE_MOUVEMENT, peutGerer, stockBas, type Article, type Mouvement, type TypeMouvement } from '../types'

type TypeSaisie = Exclude<TypeMouvement, 'ajustement'>

export default function ArticleFiche() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { profil, session } = useAuth()
  const gere = peutGerer(profil?.role)
  const [article, setArticle] = useState<Article | null>(null)
  const [mouvements, setMouvements] = useState<Mouvement[]>([])
  const [chantiers, setChantiers] = useState<{ id: string; titre: string }[]>([])
  const [noms, setNoms] = useState<Map<string, string>>(new Map())
  const [introuvable, setIntrouvable] = useState(false)
  const [edition, setEdition] = useState(false)
  const [type, setType] = useState<TypeSaisie>(gere ? 'entree' : 'sortie')
  const [quantite, setQuantite] = useState('')
  const [chantierId, setChantierId] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')

  async function charger() {
    const [a, m, c, p] = await Promise.all([
      supabase.from('articles').select('*').eq('id', id).maybeSingle(),
      supabase.from('mouvements_stock').select('*, chantiers(titre)').eq('article_id', id).order('created_at', { ascending: false }).limit(50),
      supabase.from('chantiers').select('id, titre, chef_id').in('statut', ['en_cours', 'en_pause', 'a_planifier']).order('titre'),
      supabase.from('profils').select('id, nom'),
    ])
    if (!a.data) return setIntrouvable(true)
    setArticle(a.data as Article)
    setMouvements((m.data ?? []) as Mouvement[])
    const tous = (c.data ?? []) as { id: string; titre: string; chef_id: string | null }[]
    setChantiers(gere ? tous : tous.filter((x) => x.chef_id === session?.user.id))
    setNoms(new Map(((p.data ?? []) as { id: string; nom: string }[]).map((x) => [x.id, x.nom])))
  }
  useEffect(() => { void charger() }, [id])

  if (!profil || profil.role === 'ouvrier') return <p className={carte}>Accès non autorisé.</p>
  if (introuvable) return <p className={carte}>Article introuvable.</p>
  if (!article) return <p className="text-center text-gray-500">Chargement…</p>

  const types: TypeSaisie[] = gere ? ['entree', 'sortie', 'retour', 'perte'] : ['sortie', 'retour']
  const besoinChantier = type === 'sortie' || type === 'retour'

  async function enregistrerMouvement(e: FormEvent) {
    e.preventDefault()
    const n = nombre(quantite)
    if (Number.isNaN(n) || n <= 0) return setMsg('Saisissez une quantité supérieure à 0.')
    if (type === 'sortie' || type === 'retour') {
      if (!chantierId) return setMsg('Choisissez le chantier.')
    }
    if ((type === 'sortie' || type === 'perte') && n > article!.stock) return setMsg(`Stock insuffisant : ${qte(article!.stock)} ${article!.unite} disponible.`)
    const delta = type === 'sortie' || type === 'perte' ? -n : n
    const { error } = await supabase.from('mouvements_stock').insert({
      article_id: id, type, delta, chantier_id: chantierId || null, note: note.trim() || null,
    })
    if (error) return setMsg(error.message)
    setMsg('')
    setQuantite('')
    setNote('')
    await charger()
  }

  async function modifier(v: ArticleSaisie) {
    const { error } = await supabase.from('articles').update({ nom: v.nom, categorie: v.categorie, unite: v.unite, seuil_alerte: v.seuil_alerte }).eq('id', id)
    if (error) return error.code === '23505' ? 'Un article porte déjà ce nom.' : error.message
    setEdition(false)
    await charger()
    return null
  }

  async function archiver() {
    const avertissement = article!.stock > 0 ? ` Il reste ${qte(article!.stock)} ${article!.unite} en stock.` : ''
    if (!confirm(`Retirer cet article de la liste ?${avertissement}`)) return
    const { error } = await supabase.from('articles').update({ actif: false }).eq('id', id)
    if (error) return setMsg(error.message)
    nav('/stock')
  }

  return (
    <div className="space-y-3">
      <Link to="/stock" className="text-sm underline">← Stock</Link>
      <div className={`${carte} space-y-2`}>
        {edition ? (
          <ArticleForm initial={article} libelle="Enregistrer" onSubmit={modifier} />
        ) : (
          <>
            <h1 className="text-xl font-bold">{article.nom}</h1>
            <p className="text-sm text-gray-500">{LIBELLE_CATEGORIE[article.categorie] ?? article.categorie}{article.seuil_alerte > 0 && ` · alerte à ${qte(article.seuil_alerte)} ${article.unite}`}</p>
            <p className={`text-3xl font-bold ${stockBas(article) ? 'text-red-600' : ''}`}>{qte(article.stock)} <span className="text-base font-normal text-gray-500">{article.unite}</span></p>
            {stockBas(article) && <p className="text-sm font-semibold text-red-600">{article.stock === 0 ? 'Article épuisé.' : 'Stock bas : pensez à racheter.'}</p>}
            {gere && (
              <div className="flex items-center gap-3">
                <button className={btnSec} onClick={() => setEdition(true)}>Modifier</button>
                <button className="text-sm text-red-600" onClick={() => void archiver()}>Retirer de la liste</button>
              </div>
            )}
          </>
        )}
        {edition && <button className="text-sm underline" onClick={() => setEdition(false)}>Annuler</button>}
      </div>

      <form onSubmit={enregistrerMouvement} className={`${carte} space-y-3`}>
        <h2 className="font-bold">Enregistrer un mouvement</h2>
        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <button type="button" key={t} onClick={() => setType(t)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${type === t ? 'bg-nuit text-white' : 'bg-gray-100'}`}>
              {LIBELLE_MOUVEMENT[t]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={etiquette}>Quantité ({article.unite})</label><input className={champ} inputMode="decimal" value={quantite} onChange={(e) => setQuantite(e.target.value)} required /></div>
          {(besoinChantier || gere) && (
            <div>
              <label className={etiquette}>Chantier{besoinChantier ? '' : ' (facultatif)'}</label>
              <select className={champ} value={chantierId} onChange={(e) => setChantierId(e.target.value)}>
                <option value="">{besoinChantier ? 'Choisir…' : 'Aucun'}</option>
                {chantiers.map((c) => <option key={c.id} value={c.id}>{c.titre}</option>)}
              </select>
            </div>
          )}
        </div>
        <div><label className={etiquette}>Note (facultatif)</label><input className={champ} value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === 'entree' ? 'Ex. Achat chez le fournisseur' : type === 'perte' ? 'Ex. Pot renversé' : ''} /></div>
        {!chantiers.length && !gere && <p className="text-sm text-gray-500">Aucun chantier ne vous est confié : vous ne pouvez pas enregistrer de sortie.</p>}
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        <button className={btn}>Enregistrer</button>
      </form>

      <div className={`${carte} space-y-2`}>
        <h2 className="font-bold">Historique</h2>
        {mouvements.map((m) => (
          <div key={m.id} className="flex items-start justify-between gap-2 border-t border-gray-100 pt-2 text-sm">
            <div>
              <p className="font-semibold">{LIBELLE_MOUVEMENT[m.type]}{m.chantiers?.titre && ` · ${m.chantiers.titre}`}</p>
              <p className="text-gray-500">{dateFr(m.created_at)} · {noms.get(m.auteur_id ?? '') ?? '—'}{m.note && ` · ${m.note}`}</p>
            </div>
            <b className={m.delta > 0 ? 'text-green-700' : 'text-red-600'}>{m.delta > 0 ? '+' : ''}{qte(m.delta)}</b>
          </div>
        ))}
        {!mouvements.length && <p className="text-sm text-gray-500">Aucun mouvement.</p>}
        {mouvements.length === 50 && <p className="text-xs text-gray-500">Les 50 derniers mouvements sont affichés.</p>}
      </div>
    </div>
  )
}
