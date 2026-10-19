import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { dateFr, fcfa } from '../lib/format'
import { UNITES } from '../lib/documents'
import { nombre } from '../lib/stock'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte, champ, etiquette } from '../lib/ui'
import { LIBELLE_TRAVAUX, peutGerer, type PrestationStats, type TypeTravaux } from '../types'

export default function Prestations() {
  const { profil } = useAuth()
  const [liste, setListe] = useState<PrestationStats[]>([])
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [ouvert, setOuvert] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [designation, setDesignation] = useState('')
  const [unite, setUnite] = useState('m²')
  const [prix, setPrix] = useState('')
  const [typeTravaux, setTypeTravaux] = useState<TypeTravaux>('peinture')
  const [msg, setMsg] = useState('')

  async function charger() {
    const { data, error } = await supabase.from('prestations_stats').select('*').eq('actif', true).order('designation')
    if (error) setMsg(error.message)
    setListe((data ?? []) as PrestationStats[])
  }
  useEffect(() => { void charger() }, [])

  if (!peutGerer(profil?.role)) return <p className={carte}>Accès non autorisé.</p>

  function ouvrir(p?: PrestationStats) {
    setEditId(p?.id ?? null)
    setDesignation(p?.designation ?? '')
    setUnite(p?.unite ?? 'm²')
    setPrix(p ? String(p.prix_unitaire) : '')
    setTypeTravaux(p?.type_travaux ?? 'peinture')
    setOuvert(true)
    setMsg('')
  }

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    const n = nombre(prix)
    if (Number.isNaN(n) || n < 0 || !Number.isInteger(n)) return setMsg('Le prix doit être un nombre entier positif ou nul (FCFA).')
    const champs = { designation: designation.trim(), unite, prix_unitaire: n, type_travaux: typeTravaux }
    const { error } = editId ? await supabase.from('prestations').update(champs).eq('id', editId) : await supabase.from('prestations').insert(champs)
    if (error) return setMsg(error.code === '23505' ? 'Une prestation porte déjà cette désignation.' : error.message)
    setMsg('')
    setOuvert(false)
    await charger()
  }

  async function retirer(p: PrestationStats) {
    if (!confirm(`Retirer « ${p.designation} » de la bibliothèque ?`)) return
    const { error } = await supabase.from('prestations').update({ actif: false }).eq('id', p.id)
    setMsg(error ? error.message : '')
    await charger()
  }

  const terme = q.toLowerCase()
  const affichees = liste.filter((p) => p.designation.toLowerCase().includes(terme) && (!type || p.type_travaux === type))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Bibliothèque de prix</h1>
        <button className={ouvert ? btnSec : btn} onClick={() => (ouvert ? setOuvert(false) : ouvrir())}>{ouvert ? 'Fermer' : 'Nouvelle prestation'}</button>
      </div>
      <p className="text-sm text-gray-500">Ajoutez ces prestations dans vos devis et factures avec « Ajouter depuis la bibliothèque ». Les prix réels se calculent sur les factures émises qui reprennent la désignation à l'identique.</p>

      {ouvert && (
        <form onSubmit={enregistrer} className={`${carte} space-y-3`}>
          <div><label className={etiquette}>Désignation</label><input className={champ} value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Ex. Peinture murs intérieurs, 2 couches" required /></div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={etiquette}>Unité</label>
              <select className={champ} value={unite} onChange={(e) => setUnite(e.target.value)}>{UNITES.map((u) => <option key={u}>{u}</option>)}</select>
            </div>
            <div><label className={etiquette}>Prix (FCFA)</label><input className={champ} inputMode="numeric" value={prix} onChange={(e) => setPrix(e.target.value)} required /></div>
            <div>
              <label className={etiquette}>Travaux</label>
              <select className={champ} value={typeTravaux} onChange={(e) => setTypeTravaux(e.target.value as TypeTravaux)}>
                {Object.entries(LIBELLE_TRAVAUX).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
          </div>
          {editId && <p className="text-xs text-gray-500">Changer la désignation coupe le lien avec les factures passées : les prix réels repartent de zéro.</p>}
          {msg && <p className="text-sm text-red-600">{msg}</p>}
          <button className={btn}>{editId ? 'Enregistrer' : 'Ajouter à la bibliothèque'}</button>
        </form>
      )}
      {!ouvert && msg && <p className="text-sm text-red-600">{msg}</p>}

      <input className={champ} placeholder="Rechercher une prestation" value={q} onChange={(e) => setQ(e.target.value)} />
      <select className={champ} value={type} onChange={(e) => setType(e.target.value)} aria-label="Type de travaux">
        <option value="">Tous les travaux</option>
        {Object.entries(LIBELLE_TRAVAUX).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>

      {affichees.map((p) => {
        const ecart = p.moyen !== null && p.prix_unitaire > 0 ? Math.round(((p.moyen - p.prix_unitaire) / p.prix_unitaire) * 100) : null
        return (
          <div key={p.id} className={`${carte} space-y-1`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{p.designation}</p>
                <p className="text-sm text-gray-500">{LIBELLE_TRAVAUX[p.type_travaux]}</p>
              </div>
              <p className="whitespace-nowrap text-lg font-bold">{fcfa(p.prix_unitaire)} <span className="text-sm font-normal text-gray-500">/ {p.unite}</span></p>
            </div>
            {p.nb > 0 ? (
              <div className="text-sm">
                <p>Prix réels : moyenne <b>{fcfa(p.moyen ?? 0)}</b> (de {fcfa(p.minimum ?? 0)} à {fcfa(p.maximum ?? 0)}) sur {p.nb} ligne{p.nb > 1 ? 's' : ''} facturée{p.nb > 1 ? 's' : ''}</p>
                <p className="text-gray-500">Dernier prix : {fcfa(p.dernier ?? 0)} le {dateFr(p.derniere_date)}
                  {ecart !== null && ecart !== 0 && <span className={ecart < 0 ? ' font-semibold text-red-600' : ' font-semibold text-green-700'}> · moyenne {ecart > 0 ? '+' : ''}{ecart} % par rapport au prix de référence</span>}
                </p>
              </div>
            ) : <p className="text-sm text-gray-500">Pas encore facturée.</p>}
            <div className="flex items-center gap-3 pt-1">
              <button className="text-sm underline" onClick={() => ouvrir(p)}>Modifier</button>
              <button className="text-sm text-red-600" onClick={() => void retirer(p)}>Retirer</button>
            </div>
          </div>
        )
      })}
      {!affichees.length && <p className="text-center text-gray-500">Aucune prestation. Ajoutez vos travaux courants pour chiffrer plus vite.</p>}
      <Link to="/devis/nouveau" className="block text-center text-sm underline">Créer un devis</Link>
    </div>
  )
}
