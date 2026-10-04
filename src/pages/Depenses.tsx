import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { aujourdhui, dateFr, fcfa } from '../lib/format'
import { nombre } from '../lib/stock'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte, champ, etiquette } from '../lib/ui'
import { LIBELLE_DEPENSE, peutGerer, type CategorieDepense, type Depense } from '../types'

export default function Depenses() {
  const { profil } = useAuth()
  const [params] = useSearchParams()
  const [liste, setListe] = useState<Depense[]>([])
  const [chantiers, setChantiers] = useState<{ id: string; titre: string }[]>([])
  const [filtreChantier, setFiltreChantier] = useState(params.get('chantier') ?? '')
  const [filtreCat, setFiltreCat] = useState('')
  const [ouvert, setOuvert] = useState(!!params.get('chantier'))
  const [chantierId, setChantierId] = useState(params.get('chantier') ?? '')
  const [categorie, setCategorie] = useState<CategorieDepense>('materiaux')
  const [montant, setMontant] = useState('')
  const [date, setDate] = useState(aujourdhui())
  const [description, setDescription] = useState('')
  const [fournisseur, setFournisseur] = useState('')
  const [msg, setMsg] = useState('')

  async function charger() {
    const [d, c] = await Promise.all([
      supabase.from('depenses').select('*, chantiers(titre)').order('date_depense', { ascending: false }).order('created_at', { ascending: false }).limit(300),
      supabase.from('chantiers').select('id, titre').order('titre'),
    ])
    if (d.error) setMsg(d.error.message)
    setListe((d.data ?? []) as Depense[])
    setChantiers((c.data ?? []) as { id: string; titre: string }[])
  }
  useEffect(() => { void charger() }, [])

  if (!peutGerer(profil?.role)) return <p className={carte}>Accès non autorisé.</p>

  const affichees = liste.filter(
    (d) => (!filtreChantier || (filtreChantier === 'generaux' ? d.chantier_id === null : d.chantier_id === filtreChantier)) && (!filtreCat || d.categorie === filtreCat),
  )
  const total = affichees.reduce((s, d) => s + d.montant, 0)

  async function ajouter(e: FormEvent) {
    e.preventDefault()
    const m = nombre(montant)
    if (Number.isNaN(m) || m <= 0 || !Number.isInteger(m)) return setMsg('Saisissez un montant entier supérieur à 0 (en FCFA).')
    if (date > aujourdhui()) return setMsg('La date ne peut pas être dans le futur.')
    const { error } = await supabase.from('depenses').insert({
      chantier_id: chantierId || null, categorie, montant: m, date_depense: date,
      description: description.trim(), fournisseur: fournisseur.trim() || null,
    })
    if (error) return setMsg(error.message)
    setMsg('')
    setMontant('')
    setDescription('')
    setFournisseur('')
    await charger()
  }

  async function supprimer(d: Depense) {
    if (!confirm(`Supprimer la dépense « ${d.description} » de ${fcfa(d.montant)} ?`)) return
    const { error } = await supabase.from('depenses').delete().eq('id', d.id)
    setMsg(error ? error.message : '')
    await charger()
  }

  return (
    <div className="space-y-3">
      <Link to="/finances" className="text-sm underline">← Finances</Link>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Dépenses</h1>
        <button className={ouvert ? btnSec : btn} onClick={() => setOuvert(!ouvert)}>{ouvert ? 'Fermer' : 'Nouvelle dépense'}</button>
      </div>

      {ouvert && (
        <form onSubmit={ajouter} className={`${carte} space-y-3`}>
          <div>
            <label className={etiquette}>Chantier</label>
            <select className={champ} value={chantierId} onChange={(e) => setChantierId(e.target.value)}>
              <option value="">Frais généraux (aucun chantier)</option>
              {chantiers.map((c) => <option key={c.id} value={c.id}>{c.titre}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={etiquette}>Catégorie</label>
              <select className={champ} value={categorie} onChange={(e) => setCategorie(e.target.value as CategorieDepense)}>
                {Object.entries(LIBELLE_DEPENSE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div><label className={etiquette}>Montant (FCFA)</label><input className={champ} inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={etiquette}>Date</label><input className={champ} type="date" value={date} max={aujourdhui()} onChange={(e) => setDate(e.target.value)} required /></div>
            <div><label className={etiquette}>Fournisseur</label><input className={champ} value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} placeholder="facultatif" /></div>
          </div>
          <div><label className={etiquette}>Description</label><input className={champ} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex. 10 seaux de peinture blanche" required /></div>
          {msg && <p className="text-sm text-red-600">{msg}</p>}
          <button className={btn}>Enregistrer la dépense</button>
        </form>
      )}

      <div className="grid grid-cols-2 gap-2">
        <select className={champ} value={filtreChantier} onChange={(e) => setFiltreChantier(e.target.value)} aria-label="Chantier">
          <option value="">Tous les chantiers</option>
          <option value="generaux">Frais généraux</option>
          {chantiers.map((c) => <option key={c.id} value={c.id}>{c.titre}</option>)}
        </select>
        <select className={champ} value={filtreCat} onChange={(e) => setFiltreCat(e.target.value)} aria-label="Catégorie">
          <option value="">Toutes les catégories</option>
          {Object.entries(LIBELLE_DEPENSE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <p className="text-sm">Total affiché : <b>{fcfa(total)}</b> ({affichees.length} dépense{affichees.length > 1 ? 's' : ''})</p>
      {!ouvert && msg && <p className="text-sm text-red-600">{msg}</p>}

      {affichees.map((d) => (
        <div key={d.id} className={`${carte} flex items-start justify-between gap-2`}>
          <div>
            <p className="font-semibold">{d.description}</p>
            <p className="text-sm text-gray-500">
              {dateFr(d.date_depense)} · {LIBELLE_DEPENSE[d.categorie]} · {d.chantiers?.titre ?? 'Frais généraux'}{d.fournisseur && ` · ${d.fournisseur}`}
            </p>
          </div>
          <div className="text-right">
            <b>{fcfa(d.montant)}</b>
            {profil?.role === 'gerant' && <button className="block text-sm text-red-600" onClick={() => void supprimer(d)}>Supprimer</button>}
          </div>
        </div>
      ))}
      {!affichees.length && <p className="text-center text-gray-500">Aucune dépense.</p>}
      {liste.length === 300 && <p className="text-center text-xs text-gray-500">Les 300 dépenses les plus récentes sont affichées.</p>}
    </div>
  )
}
