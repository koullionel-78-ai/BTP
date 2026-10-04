import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { dateFr, aujourdhui } from '../lib/format'
import { nombre, qte } from '../lib/stock'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte, champ, etiquette } from '../lib/ui'
import { peutGerer, type Metre } from '../types'

const UNITES_METRE = ['m²', 'ml', 'u', 'm³']

export default function Metres() {
  const { id = '' } = useParams()
  const { profil, session } = useAuth()
  const [titre, setTitre] = useState('')
  const [chefId, setChefId] = useState<string | null>(null)
  const [lignes, setLignes] = useState<Metre[]>([])
  const [introuvable, setIntrouvable] = useState(false)
  const [piece, setPiece] = useState('')
  const [designation, setDesignation] = useState('')
  const [unite, setUnite] = useState('m²')
  const [longueur, setLongueur] = useState('')
  const [largeur, setLargeur] = useState('')
  const [nb, setNb] = useState('1')
  const [deduction, setDeduction] = useState(false)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')

  async function charger() {
    const [c, m] = await Promise.all([
      supabase.from('chantiers').select('titre, chef_id').eq('id', id).maybeSingle(),
      supabase.from('metres').select('*').eq('chantier_id', id).order('created_at'),
    ])
    if (!c.data) return setIntrouvable(true)
    setTitre(c.data.titre as string)
    setChefId((c.data.chef_id as string | null) ?? null)
    setLignes((m.data ?? []) as Metre[])
  }
  useEffect(() => { void charger() }, [id])

  const peutEcrire = peutGerer(profil?.role) || (profil?.role === 'chef_chantier' && chefId === session?.user.id)

  const pieces = useMemo(() => {
    const m = new Map<string, Metre[]>()
    for (const l of lignes) m.set(l.piece, [...(m.get(l.piece) ?? []), l])
    return [...m.entries()]
  }, [lignes])

  const postes = useMemo(() => {
    const m = new Map<string, { designation: string; unite: string; brut: number; deduit: number }>()
    for (const l of lignes) {
      const cle = `${l.designation.toLowerCase()}|${l.unite}`
      const cur = m.get(cle) ?? { designation: l.designation, unite: l.unite, brut: 0, deduit: 0 }
      if (l.deduction) cur.deduit += -l.quantite
      else cur.brut += l.quantite
      m.set(cle, cur)
    }
    return [...m.values()].sort((a, b) => a.designation.localeCompare(b.designation, 'fr'))
  }, [lignes])

  if (!profil) return null
  if (introuvable) return <p className={carte}>Chantier introuvable.</p>

  const L = nombre(longueur)
  const l2 = largeur.trim() === '' ? 1 : nombre(largeur)
  const N = nombre(nb)
  const apercu = Number.isNaN(L) || Number.isNaN(l2) || Number.isNaN(N) ? null : L * l2 * N

  async function ajouter(e: FormEvent) {
    e.preventDefault()
    if (Number.isNaN(L) || L < 0) return setMsg('La longueur doit être un nombre positif ou nul.')
    if (largeur.trim() !== '' && (Number.isNaN(l2) || l2 < 0)) return setMsg('La largeur doit être un nombre positif ou nul.')
    if (Number.isNaN(N) || N <= 0) return setMsg('Le nombre doit être supérieur à 0.')
    const { error } = await supabase.from('metres').insert({
      chantier_id: id, piece: piece.trim(), designation: designation.trim(), unite,
      longueur: L, largeur: largeur.trim() === '' ? null : l2, nombre: N, deduction, note: note.trim() || null,
    })
    if (error) return setMsg(error.message)
    setMsg('')
    setLongueur('')
    setLargeur('')
    setNb('1')
    setDeduction(false)
    setNote('')
    await charger()
  }

  async function supprimer(m: Metre) {
    if (!confirm(`Supprimer cette ligne (${m.piece} · ${m.designation}) ?`)) return
    const { error } = await supabase.from('metres').delete().eq('id', m.id)
    setMsg(error ? error.message : '')
    await charger()
  }

  const formule = (m: Metre) =>
    [qte(m.longueur), m.largeur !== null ? qte(m.largeur) : null, m.nombre !== 1 ? qte(m.nombre) : null].filter(Boolean).join(' × ')

  return (
    <div className="space-y-3">
      <div className="no-print"><Link to={`/chantiers/${id}`} className="text-sm underline">← {titre || 'Chantier'}</Link></div>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Métrés{titre && ` · ${titre}`}</h1>
        <button className={`${btnSec} no-print`} onClick={() => window.print()}>Imprimer / PDF</button>
      </div>
      <p className="hidden text-sm print:block">Édité le {dateFr(aujourdhui())}</p>

      {peutEcrire && (
        <form onSubmit={ajouter} className={`${carte} no-print space-y-3`}>
          <h2 className="font-bold">Ajouter une mesure</h2>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={etiquette}>Pièce</label>
              <input className={champ} list="pieces" value={piece} onChange={(e) => setPiece(e.target.value)} placeholder="Ex. Salon" required />
              <datalist id="pieces">{pieces.map(([p]) => <option key={p} value={p} />)}</datalist>
            </div>
            <div>
              <label className={etiquette}>Poste de travaux</label>
              <input className={champ} list="postes" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Ex. Peinture murs" required />
              <datalist id="postes">{postes.map((p) => <option key={p.designation} value={p.designation} />)}</datalist>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-1"><label className={etiquette}>Longueur</label><input className={champ} inputMode="decimal" value={longueur} onChange={(e) => setLongueur(e.target.value)} required /></div>
            <div className="col-span-1"><label className={etiquette}>Largeur</label><input className={champ} inputMode="decimal" value={largeur} onChange={(e) => setLargeur(e.target.value)} placeholder="facult." /></div>
            <div className="col-span-1"><label className={etiquette}>Nombre</label><input className={champ} inputMode="decimal" value={nb} onChange={(e) => setNb(e.target.value)} /></div>
            <div className="col-span-1">
              <label className={etiquette}>Unité</label>
              <select className={champ} value={unite} onChange={(e) => setUnite(e.target.value)}>{UNITES_METRE.map((u) => <option key={u}>{u}</option>)}</select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={deduction} onChange={(e) => setDeduction(e.target.checked)} /> À déduire (porte, fenêtre, ouverture…)</label>
          <input className={champ} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (facultatif)" />
          {apercu !== null && <p className="text-sm">Quantité : <b className={deduction ? 'text-red-600' : ''}>{deduction ? '− ' : ''}{qte(apercu)} {unite}</b></p>}
          {msg && <p className="text-sm text-red-600">{msg}</p>}
          <button className={btn}>Ajouter</button>
        </form>
      )}
      {!peutEcrire && msg && <p className="text-sm text-red-600">{msg}</p>}

      {postes.length > 0 && (
        <div className={`${carte} impression space-y-2`}>
          <h2 className="font-bold">Totaux par poste</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-sm">
              <thead><tr className="border-b-2 border-nuit text-left"><th className="py-1">Poste</th><th className="py-1 text-right">Mesuré</th><th className="py-1 text-right">Déduit</th><th className="py-1 text-right">Net</th></tr></thead>
              <tbody>
                {postes.map((p) => (
                  <tr key={p.designation + p.unite} className="border-b border-gray-100">
                    <td className="py-1.5">{p.designation}</td>
                    <td className="py-1.5 text-right">{qte(p.brut)}</td>
                    <td className="py-1.5 text-right text-red-600">{p.deduit ? `− ${qte(p.deduit)}` : '—'}</td>
                    <td className="py-1.5 text-right font-bold">{qte(p.brut - p.deduit)} {p.unite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pieces.map(([nomPiece, liste]) => (
        <div key={nomPiece} className={`${carte} impression space-y-2`}>
          <h2 className="font-bold">{nomPiece}</h2>
          {liste.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-2 border-t border-gray-100 pt-2 text-sm">
              <div>
                <p className="font-semibold">{m.deduction && <span className="mr-1 text-red-600">Déduction ·</span>}{m.designation}</p>
                <p className="text-gray-500">{formule(m)}{m.note && ` · ${m.note}`}</p>
              </div>
              <div className="flex items-center gap-3 whitespace-nowrap">
                <b className={m.quantite < 0 ? 'text-red-600' : ''}>{qte(m.quantite)} {m.unite}</b>
                {peutEcrire && <button className="no-print text-red-600" onClick={() => void supprimer(m)}>Supprimer</button>}
              </div>
            </div>
          ))}
        </div>
      ))}
      {!lignes.length && <p className="text-center text-gray-500">Aucune mesure pour ce chantier.</p>}
    </div>
  )
}
