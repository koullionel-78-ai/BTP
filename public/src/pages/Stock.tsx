import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import ArticleForm, { type ArticleSaisie } from '../components/ArticleForm'
import { qte } from '../lib/stock'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte, champ } from '../lib/ui'
import { LIBELLE_CATEGORIE, peutGerer, stockBas, type Article } from '../types'

export default function Stock() {
  const { profil } = useAuth()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [articles, setArticles] = useState<Article[]>([])
  const [q, setQ] = useState('')
  const [categorie, setCategorie] = useState('')
  const [nouveau, setNouveau] = useState(false)
  const [erreur, setErreur] = useState('')
  const basSeul = params.get('bas') === '1'
  const gere = peutGerer(profil?.role)

  useEffect(() => {
    supabase.from('articles').select('*').eq('actif', true).order('nom').then(({ data, error }) => {
      if (error) setErreur(error.message)
      else setArticles(data as Article[])
    })
  }, [])

  if (!profil || profil.role === 'ouvrier') return <p className={carte}>Accès non autorisé.</p>

  async function creer(v: ArticleSaisie) {
    const { data, error } = await supabase.from('articles')
      .insert({ nom: v.nom, categorie: v.categorie, unite: v.unite, seuil_alerte: v.seuil_alerte }).select('id').single()
    if (error) return error.code === '23505' ? 'Un article porte déjà ce nom.' : error.message
    if (v.stock_initial > 0) {
      const m = await supabase.from('mouvements_stock').insert({ article_id: data.id, type: 'entree', delta: v.stock_initial, note: 'Stock initial' })
      if (m.error) return "Article créé, mais le stock initial n'a pas été enregistré : " + m.error.message
    }
    nav(`/stock/${data.id}`)
    return null
  }

  const nbBas = articles.filter(stockBas).length
  const terme = q.toLowerCase()
  const affiches = articles.filter(
    (a) => a.nom.toLowerCase().includes(terme) && (!categorie || a.categorie === categorie) && (!basSeul || stockBas(a)),
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Stock ({articles.length})</h1>
        {gere && (
          <div className="flex gap-2">
            <Link to="/inventaires" className={btnSec}>Inventaire</Link>
            <button className={nouveau ? btnSec : btn} onClick={() => setNouveau(!nouveau)}>{nouveau ? 'Annuler' : 'Nouvel article'}</button>
          </div>
        )}
      </div>
      {nouveau && <div className={carte}><ArticleForm libelle="Créer l'article" onSubmit={creer} /></div>}

      {nbBas > 0 && (
        <button
          onClick={() => setParams(basSeul ? {} : { bas: '1' })}
          className={`${carte} w-full border border-orange-200 bg-orange-50 text-left font-semibold text-orange-800`}
        >
          {nbBas} article{nbBas > 1 ? 's' : ''} en stock bas · {basSeul ? 'Tout afficher' : 'Voir seulement ceux-là'}
        </button>
      )}

      <input className={champ} placeholder="Rechercher un article" value={q} onChange={(e) => setQ(e.target.value)} />
      <select className={champ} value={categorie} onChange={(e) => setCategorie(e.target.value)} aria-label="Catégorie">
        <option value="">Toutes les catégories</option>
        {Object.entries(LIBELLE_CATEGORIE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {affiches.map((a) => (
        <Link key={a.id} to={`/stock/${a.id}`} className={`${carte} flex items-center justify-between gap-2`}>
          <div>
            <p className="font-semibold">{a.nom}</p>
            <p className="text-sm text-gray-500">{LIBELLE_CATEGORIE[a.categorie] ?? a.categorie}{a.seuil_alerte > 0 && ` · alerte à ${qte(a.seuil_alerte)}`}</p>
          </div>
          <div className="text-right">
            <p className={`text-lg font-bold ${stockBas(a) ? 'text-red-600' : ''}`}>{qte(a.stock)} <span className="text-sm font-normal text-gray-500">{a.unite}</span></p>
            {stockBas(a) && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{a.stock === 0 ? 'Épuisé' : 'Stock bas'}</span>}
          </div>
        </Link>
      ))}
      {!affiches.length && <p className="text-center text-gray-500">Aucun article.</p>}
    </div>
  )
}
