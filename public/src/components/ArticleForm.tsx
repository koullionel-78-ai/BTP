import { useState, type FormEvent } from 'react'
import { nombre, UNITES_STOCK } from '../lib/stock'
import { btn, champ, etiquette } from '../lib/ui'
import { LIBELLE_CATEGORIE, type Article } from '../types'

export interface ArticleSaisie {
  nom: string
  categorie: string
  unite: string
  seuil_alerte: number
  stock_initial: number
}

interface Props {
  initial?: Pick<Article, 'nom' | 'categorie' | 'unite' | 'seuil_alerte'>
  libelle: string
  onSubmit: (v: ArticleSaisie) => Promise<string | null>
}

export default function ArticleForm({ initial, libelle, onSubmit }: Props) {
  const [nom, setNom] = useState(initial?.nom ?? '')
  const [categorie, setCategorie] = useState(initial?.categorie ?? 'peinture')
  const [unite, setUnite] = useState(initial?.unite ?? 'u')
  const [seuil, setSeuil] = useState(String(initial?.seuil_alerte ?? 0))
  const [stockInitial, setStockInitial] = useState('0')
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)

  async function soumettre(e: FormEvent) {
    e.preventDefault()
    const s = nombre(seuil)
    const si = initial ? 0 : nombre(stockInitial)
    if (Number.isNaN(s) || s < 0) return setErreur("Le seuil d'alerte doit être un nombre positif ou nul.")
    if (Number.isNaN(si) || si < 0) return setErreur('Le stock initial doit être un nombre positif ou nul.')
    setEnvoi(true)
    const err = await onSubmit({ nom: nom.trim(), categorie, unite, seuil_alerte: s, stock_initial: si })
    setErreur(err ?? '')
    setEnvoi(false)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <div><label className={etiquette}>Nom de l'article</label><input className={champ} value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Peinture acrylique blanche 20 L" required /></div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={etiquette}>Catégorie</label>
          <select className={champ} value={categorie} onChange={(e) => setCategorie(e.target.value)}>
            {Object.entries(LIBELLE_CATEGORIE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className={etiquette}>Unité</label>
          <select className={champ} value={unite} onChange={(e) => setUnite(e.target.value)}>
            {UNITES_STOCK.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className={etiquette}>Seuil d'alerte</label><input className={champ} inputMode="decimal" value={seuil} onChange={(e) => setSeuil(e.target.value)} /></div>
        {!initial && <div><label className={etiquette}>Stock initial</label><input className={champ} inputMode="decimal" value={stockInitial} onChange={(e) => setStockInitial(e.target.value)} /></div>}
      </div>
      <p className="text-xs text-gray-500">Une alerte « stock bas » s'affiche quand le stock atteint le seuil. Laissez 0 pour ne pas être alerté.</p>
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      <button className={btn} disabled={envoi}>{envoi ? 'Patientez…' : libelle}</button>
    </form>
  )
}
