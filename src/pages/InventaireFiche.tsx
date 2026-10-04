import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { dateFr } from '../lib/format'
import { nombre, qte } from '../lib/stock'
import { supabase } from '../lib/supabase'
import { btn, carte } from '../lib/ui'
import { peutGerer, type Inventaire, type LigneInventaire } from '../types'

type Filtre = 'tous' | 'a_compter' | 'ecarts'

export default function InventaireFiche() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { profil } = useAuth()
  const [inv, setInv] = useState<Inventaire | null>(null)
  const [lignes, setLignes] = useState<LigneInventaire[]>([])
  const [saisies, setSaisies] = useState<Record<string, string>>({})
  const [bouges, setBouges] = useState<Set<string>>(new Set())
  const [filtre, setFiltre] = useState<Filtre>('tous')
  const [introuvable, setIntrouvable] = useState(false)
  const [msg, setMsg] = useState('')
  const [envoi, setEnvoi] = useState(false)

  async function charger() {
    const { data: i } = await supabase.from('inventaires').select('*').eq('id', id).maybeSingle()
    if (!i) return setIntrouvable(true)
    const iv = i as Inventaire
    setInv(iv)
    const { data: l } = await supabase.from('lignes_inventaire').select('*, articles(nom, unite, categorie)').eq('inventaire_id', id)
    const liste = ((l ?? []) as LigneInventaire[]).sort((a, b) => (a.articles?.nom ?? '').localeCompare(b.articles?.nom ?? '', 'fr'))
    setLignes(liste)
    setSaisies(Object.fromEntries(liste.map((x) => [x.id, x.quantite_comptee === null ? '' : String(x.quantite_comptee)])))
    if (iv.statut === 'en_cours') {
      // articles dont le stock a bougé depuis le démarrage (hors inventaire)
      const { data: m } = await supabase.from('mouvements_stock').select('article_id')
        .gte('created_at', (i as { created_at: string }).created_at).is('inventaire_id', null)
      setBouges(new Set((m ?? []).map((x) => x.article_id as string)))
    }
  }
  useEffect(() => { void charger() }, [id])

  if (!peutGerer(profil?.role)) return <p className={carte}>Accès non autorisé.</p>
  if (introuvable) return <p className={carte}>Inventaire introuvable.</p>
  if (!inv) return <p className="text-center text-gray-500">Chargement…</p>

  const ouvert = inv.statut === 'en_cours'

  async function enregistrerLigne(l: LigneInventaire) {
    const brut = saisies[l.id] ?? ''
    const n = brut.trim() === '' ? null : nombre(brut)
    if (n !== null && (Number.isNaN(n) || n < 0)) return setMsg('Quantité invalide : nombre positif ou nul attendu.')
    if (n === l.quantite_comptee) return
    const { error } = await supabase.from('lignes_inventaire').update({ quantite_comptee: n }).eq('id', l.id)
    if (error) return setMsg(error.message)
    setMsg('')
    setLignes((x) => x.map((y) => (y.id === l.id ? { ...y, quantite_comptee: n } : y)))
  }

  const comptees = lignes.filter((l) => l.quantite_comptee !== null)
  const ecarts = comptees.filter((l) => l.quantite_comptee !== l.stock_theorique)
  const affichees = lignes.filter((l) =>
    filtre === 'tous' ? true : filtre === 'a_compter' ? l.quantite_comptee === null : l.quantite_comptee !== null && l.quantite_comptee !== l.stock_theorique)
  const nbBouges = lignes.filter((l) => bouges.has(l.article_id) && ouvert).length

  async function valider() {
    if (!comptees.length) return setMsg('Comptez au moins un article avant de valider.')
    const restant = lignes.length - comptees.length
    const texte = `Valider l'inventaire ?\n\n${ecarts.length} ajustement(s) de stock seront enregistrés.` +
      (restant ? `\n${restant} article(s) non comptés resteront inchangés.` : '') + '\n\nCette action est définitive.'
    if (!confirm(texte)) return
    setEnvoi(true)
    const { error } = await supabase.rpc('valider_inventaire', { p_id: id })
    setEnvoi(false)
    if (error) return setMsg(error.message)
    setMsg('')
    await charger()
  }

  async function annuler() {
    if (!confirm("Abandonner cet inventaire ? Les quantités saisies seront perdues, le stock n'est pas modifié.")) return
    const { error } = await supabase.from('inventaires').delete().eq('id', id)
    if (error) return setMsg(error.message)
    nav('/inventaires')
  }

  return (
    <div className="space-y-3">
      <Link to="/inventaires" className="text-sm underline">← Inventaires</Link>
      <div className={`${carte} space-y-2`}>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold">Inventaire du {dateFr(inv.date_inventaire)}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ouvert ? 'bg-chantier/30 text-nuit' : 'bg-green-100 text-green-700'}`}>{ouvert ? 'En cours' : 'Validé'}</span>
        </div>
        {inv.note && <p className="text-sm text-gray-500">{inv.note}</p>}
        <p className="text-sm">{comptees.length} / {lignes.length} articles comptés · <b className={ecarts.length ? 'text-red-600' : ''}>{ecarts.length} écart{ecarts.length > 1 ? 's' : ''}</b></p>
        {!ouvert && inv.valide_le && <p className="text-sm text-gray-500">Validé le {dateFr(inv.valide_le)}. Les écarts ont été appliqués au stock.</p>}
      </div>

      {ouvert && nbBouges > 0 && (
        <p className={`${carte} border border-orange-200 bg-orange-50 text-sm text-orange-800`}>
          {nbBouges} article{nbBouges > 1 ? 's ont' : ' a'} bougé depuis le démarrage (repérés « mouvement depuis le début »). L'écart est calculé par rapport au stock du démarrage : si le mouvement a eu lieu avant votre comptage, vérifiez la quantité saisie.
        </p>
      )}

      <div className="flex gap-2 overflow-x-auto">
        {([['tous', 'Tous'], ['a_compter', 'À compter'], ['ecarts', 'Écarts']] as [Filtre, string][]).map(([f, l]) => (
          <button key={f} onClick={() => setFiltre(f)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${filtre === f ? 'bg-nuit text-white' : 'bg-white'}`}>{l}</button>
        ))}
      </div>

      {affichees.map((l) => {
        const ecart = l.quantite_comptee === null ? null : l.quantite_comptee - l.stock_theorique
        return (
          <div key={l.id} className={`${carte} flex items-center justify-between gap-3`}>
            <div className="min-w-0">
              <p className="truncate font-semibold">{l.articles?.nom}</p>
              <p className="text-sm text-gray-500">Théorique : {qte(l.stock_theorique)} {l.articles?.unite}</p>
              {ouvert && bouges.has(l.article_id) && <p className="text-xs font-semibold text-orange-700">Mouvement depuis le début</p>}
            </div>
            <div className="text-right">
              {ouvert ? (
                <input
                  className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-right outline-none focus:border-nuit"
                  inputMode="decimal"
                  placeholder="Compté"
                  aria-label={`Quantité comptée pour ${l.articles?.nom}`}
                  value={saisies[l.id] ?? ''}
                  onChange={(e) => setSaisies({ ...saisies, [l.id]: e.target.value })}
                  onBlur={() => void enregistrerLigne(l)}
                />
              ) : (
                <p className="font-bold">{l.quantite_comptee === null ? 'Non compté' : qte(l.quantite_comptee)}</p>
              )}
              {ecart !== null && ecart !== 0 && <p className={`text-sm font-bold ${ecart > 0 ? 'text-green-700' : 'text-red-600'}`}>Écart {ecart > 0 ? '+' : ''}{qte(ecart)}</p>}
            </div>
          </div>
        )
      })}
      {!affichees.length && <p className="text-center text-gray-500">Aucun article dans ce filtre.</p>}

      {msg && <p className="text-sm text-red-600">{msg}</p>}
      {ouvert && (
        <div className="space-y-2">
          {profil?.role === 'gerant' ? (
            <button className={btn} onClick={() => void valider()} disabled={envoi}>{envoi ? 'Validation…' : "Valider l'inventaire"}</button>
          ) : (
            <p className="text-sm text-gray-500">Seul le gérant peut valider l'inventaire et corriger le stock.</p>
          )}
          <div><button className="text-sm text-red-600" onClick={() => void annuler()}>Abandonner l'inventaire</button></div>
        </div>
      )}
    </div>
  )
}
