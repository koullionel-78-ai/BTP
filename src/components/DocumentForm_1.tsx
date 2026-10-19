import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { fcfa } from '../lib/format'
import { totaux, UNITES } from '../lib/documents'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte, champ, etiquette } from '../lib/ui'
import type { Ligne } from '../types'

export interface DocSaisie {
  client_id: string
  chantier_id: string | null
  objet: string
  tva_pct: number
  remise: number
  notes: string | null
  validite_jours: number
  date_echeance: string
  lignes: Ligne[]
}

interface LigneEdit { description: string; quantite: string; unite: string; prix: string }

interface Props {
  type: 'devis' | 'facture'
  clients: { id: string; nom: string }[]
  chantiers: { id: string; titre: string; client_id: string | null }[]
  initial: Partial<DocSaisie>
  libelle: string
  onSubmit: (v: DocSaisie) => Promise<string | null>
}

const vide = (): LigneEdit => ({ description: '', quantite: '1', unite: 'm²', prix: '' })
const nombre = (s: string) => {
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export default function DocumentForm({ type, clients, chantiers, initial, libelle, onSubmit }: Props) {
  const [clientId, setClientId] = useState(initial.client_id ?? '')
  const [chantierId, setChantierId] = useState(initial.chantier_id ?? '')
  const [objet, setObjet] = useState(initial.objet ?? '')
  const [tva, setTva] = useState(String(initial.tva_pct ?? 0))
  const [remise, setRemise] = useState(String(initial.remise ?? 0))
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [validite, setValidite] = useState(String(initial.validite_jours ?? 30))
  const [echeance, setEcheance] = useState(
    initial.date_echeance ?? new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
  )
  const [lignes, setLignes] = useState<LigneEdit[]>(
    initial.lignes?.length
      ? initial.lignes.map((l) => ({ description: l.description, quantite: String(l.quantite), unite: l.unite, prix: String(l.prix_unitaire) }))
      : [vide()],
  )
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [prestations, setPrestations] = useState<{ id: string; designation: string; unite: string; prix_unitaire: number }[]>([])

  useEffect(() => {
    supabase.from('prestations').select('id, designation, unite, prix_unitaire').eq('actif', true).order('designation')
      .then(({ data }) => setPrestations((data ?? []) as { id: string; designation: string; unite: string; prix_unitaire: number }[]))
  }, [])

  function ajouterPrestation(pid: string) {
    const p = prestations.find((x) => x.id === pid)
    if (!p) return
    const nouvelle: LigneEdit = { description: p.designation, quantite: '1', unite: p.unite, prix: String(p.prix_unitaire) }
    const premiereVide = lignes.length === 1 && !lignes[0].description.trim() && !lignes[0].prix.trim()
    setLignes(premiereVide ? [nouvelle] : [...lignes, nouvelle])
  }

  const lignesNum: Ligne[] = useMemo(
    () => lignes.map((l) => ({ description: l.description, quantite: nombre(l.quantite), unite: l.unite, prix_unitaire: Math.round(nombre(l.prix)) })),
    [lignes],
  )
  const t = totaux(lignesNum, Math.round(nombre(remise)), nombre(tva))
  const chantiersClient = chantiers.filter((c) => !clientId || c.client_id === clientId)

  const majLigne = (i: number, k: keyof LigneEdit, v: string) =>
    setLignes(lignes.map((l, j) => (j === i ? { ...l, [k]: v } : l)))

  async function soumettre(e: FormEvent) {
    e.preventDefault()
    const utiles = lignesNum.filter((l) => l.description.trim())
    if (!clientId) return setErreur('Choisissez un client.')
    if (!utiles.length) return setErreur('Ajoutez au moins une ligne avec une description.')
    if (t.ttc < 0) return setErreur('La remise dépasse le total des lignes.')
    setEnvoi(true)
    const err = await onSubmit({
      client_id: clientId,
      chantier_id: chantierId || null,
      objet: objet.trim(),
      tva_pct: nombre(tva),
      remise: Math.round(nombre(remise)),
      notes: notes.trim() || null,
      validite_jours: Math.round(nombre(validite)) || 30,
      date_echeance: echeance,
      lignes: utiles.map((l) => ({ ...l, description: l.description.trim() })),
    })
    setErreur(err ?? '')
    setEnvoi(false)
  }

  return (
    <form onSubmit={soumettre} className="space-y-4">
      <div className={`${carte} space-y-3`}>
        <div>
          <label className={etiquette}>Client</label>
          <select className={champ} value={clientId} onChange={(e) => { setClientId(e.target.value); setChantierId('') }} required>
            <option value="">Choisir un client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>
        <div>
          <label className={etiquette}>Chantier (facultatif)</label>
          <select className={champ} value={chantierId} onChange={(e) => setChantierId(e.target.value)}>
            <option value="">Aucun</option>
            {chantiersClient.map((c) => <option key={c.id} value={c.id}>{c.titre}</option>)}
          </select>
        </div>
        <div>
          <label className={etiquette}>Objet</label>
          <input className={champ} value={objet} onChange={(e) => setObjet(e.target.value)} placeholder="Ex. Peinture salon et chambres" required />
        </div>
        {type === 'devis' ? (
          <div>
            <label className={etiquette}>Validité (jours)</label>
            <input className={champ} inputMode="numeric" value={validite} onChange={(e) => setValidite(e.target.value)} />
          </div>
        ) : (
          <div>
            <label className={etiquette}>Date d'échéance</label>
            <input className={champ} type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} required />
          </div>
        )}
      </div>

      <div className={`${carte} space-y-3`}>
        <h2 className="font-bold">Lignes</h2>
        {lignes.map((l, i) => (
          <div key={i} className="space-y-2 border-t border-gray-100 pt-3 first:border-0 first:pt-0">
            <input className={champ} value={l.description} onChange={(e) => majLigne(i, 'description', e.target.value)} placeholder="Description (ex. Peinture murs, 2 couches)" aria-label="Description" />
            <div className="grid grid-cols-3 gap-2">
              <input className={champ} inputMode="decimal" value={l.quantite} onChange={(e) => majLigne(i, 'quantite', e.target.value)} aria-label="Quantité" placeholder="Qté" />
              <select className={champ} value={l.unite} onChange={(e) => majLigne(i, 'unite', e.target.value)} aria-label="Unité">
                {[...new Set([...UNITES, l.unite])].map((u) => <option key={u}>{u}</option>)}
              </select>
              <input className={champ} inputMode="numeric" value={l.prix} onChange={(e) => majLigne(i, 'prix', e.target.value)} aria-label="Prix unitaire" placeholder="Prix unit." />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Sous-total : <b className="text-nuit">{fcfa(Math.round(lignesNum[i].quantite * lignesNum[i].prix_unitaire))}</b></span>
              {lignes.length > 1 && <button type="button" className="text-red-600" onClick={() => setLignes(lignes.filter((_, j) => j !== i))}>Retirer</button>}
            </div>
          </div>
        ))}
        <button type="button" className={btnSec} onClick={() => setLignes([...lignes, vide()])}>+ Ajouter une ligne</button>
        {prestations.length > 0 && (
          <select className={champ} value="" onChange={(e) => ajouterPrestation(e.target.value)} aria-label="Ajouter depuis la bibliothèque de prix">
            <option value="">+ Ajouter depuis la bibliothèque de prix…</option>
            {prestations.map((p) => <option key={p.id} value={p.id}>{p.designation} · {fcfa(p.prix_unitaire)} / {p.unite}</option>)}
          </select>
        )}
      </div>

      <div className={`${carte} space-y-3`}>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={etiquette}>Remise (FCFA)</label><input className={champ} inputMode="numeric" value={remise} onChange={(e) => setRemise(e.target.value)} /></div>
          <div><label className={etiquette}>TVA (%)</label><input className={champ} inputMode="decimal" value={tva} onChange={(e) => setTva(e.target.value)} /></div>
        </div>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt>Total des lignes</dt><dd>{fcfa(t.brut)}</dd></div>
          {nombre(remise) > 0 && <div className="flex justify-between"><dt>Remise</dt><dd>− {fcfa(Math.round(nombre(remise)))}</dd></div>}
          {nombre(tva) > 0 && <div className="flex justify-between"><dt>TVA {nombre(tva)} %</dt><dd>{fcfa(t.tva)}</dd></div>}
          <div className="flex justify-between border-t border-gray-200 pt-1 text-base font-bold"><dt>Total</dt><dd>{fcfa(t.ttc)}</dd></div>
        </dl>
        <div><label className={etiquette}>Notes (visibles sur le document)</label><textarea className={champ} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </div>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      <button className={btn} disabled={envoi}>{envoi ? 'Patientez…' : libelle}</button>
    </form>
  )
}
