import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'
import { carte, champ } from '../lib/ui'
import type { JournalLigne } from '../types'

const TABLES: Record<string, string> = {
  devis: 'Devis', factures: 'Factures', paiements: 'Paiements', depenses: 'Dépenses', prestations: 'Prix',
  articles: 'Articles', chantiers: 'Chantiers', profils: 'Équipe', travailleurs: 'Personnel', avances: 'Avances', paies: 'Paies',
}
const ACTION: Record<JournalLigne['action'], { libelle: string; style: string }> = {
  creation: { libelle: 'Création', style: 'bg-green-100 text-green-700' },
  modification: { libelle: 'Modification', style: 'bg-blue-100 text-blue-700' },
  suppression: { libelle: 'Suppression', style: 'bg-red-100 text-red-700' },
}
// champs techniques peu utiles à l'affichage
const MASQUES = new Set(['id', 'created_at', 'created_by'])

const court = (v: unknown) => {
  if (v === null || v === undefined || v === '') return '—'
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return s.length > 40 ? s.slice(0, 40) + '…' : s
}

export default function Journal() {
  const { profil } = useAuth()
  const [lignes, setLignes] = useState<JournalLigne[]>([])
  const [noms, setNoms] = useState<Map<string, string>>(new Map())
  const [table, setTable] = useState('')
  const [action, setAction] = useState('')
  const [ouvert, setOuvert] = useState<number | null>(null)
  const [erreur, setErreur] = useState('')
  const [pret, setPret] = useState(false)

  useEffect(() => {
    if (profil?.role !== 'gerant') return
    void (async () => {
      let q = supabase.from('journal').select('*').order('created_at', { ascending: false }).limit(200)
      if (table) q = q.eq('table_name', table)
      if (action) q = q.eq('action', action)
      const [j, p] = await Promise.all([q, supabase.from('profils').select('id, nom')])
      if (j.error) setErreur(j.error.message)
      else setErreur('')
      setLignes((j.data ?? []) as JournalLigne[])
      setNoms(new Map(((p.data ?? []) as { id: string; nom: string }[]).map((x) => [x.id, x.nom])))
      setPret(true)
    })()
  }, [profil?.role, table, action])

  if (profil?.role !== 'gerant') return <p className={carte}>Réservé au gérant.</p>

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Journal des modifications</h1>
      <p className="text-sm text-gray-500">Qui a créé, modifié ou supprimé quoi (prix, factures, paiements, dépenses, stock, paie…). Le journal est en lecture seule.</p>
      <div className="grid grid-cols-2 gap-2">
        <select className={champ} value={table} onChange={(e) => setTable(e.target.value)} aria-label="Élément">
          <option value="">Tout</option>
          {Object.entries(TABLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select className={champ} value={action} onChange={(e) => setAction(e.target.value)} aria-label="Action">
          <option value="">Toutes les actions</option>
          {Object.entries(ACTION).map(([k, a]) => <option key={k} value={k}>{a.libelle}</option>)}
        </select>
      </div>
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {!pret && <p className="text-center text-gray-500">Chargement…</p>}
      {lignes.map((l) => {
        const champs = Object.entries(l.changes ?? {}).filter(([k]) => !MASQUES.has(k))
        const modif = l.action === 'modification'
        return (
          <div key={l.id} className={`${carte} space-y-1`}>
            <button className="flex w-full items-start justify-between gap-2 text-left" onClick={() => setOuvert(ouvert === l.id ? null : l.id)}>
              <div>
                <p className="font-semibold">{TABLES[l.table_name] ?? l.table_name}{l.record_id && <span className="font-normal text-gray-400"> · {l.record_id.slice(0, 8)}</span>}</p>
                <p className="text-sm text-gray-500">{new Date(l.created_at).toLocaleString('fr-FR')} · {l.utilisateur_id ? noms.get(l.utilisateur_id) ?? 'Utilisateur supprimé' : 'Système'}</p>
              </div>
              <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${ACTION[l.action].style}`}>{ACTION[l.action].libelle}</span>
            </button>
            {modif && champs.slice(0, ouvert === l.id ? champs.length : 3).map(([k, v]) => {
              const d = v as { avant: unknown; apres: unknown }
              return <p key={k} className="text-sm"><span className="text-gray-500">{k} :</span> {court(d.avant)} <span className="text-gray-400">→</span> <b>{court(d.apres)}</b></p>
            })}
            {modif && champs.length > 3 && ouvert !== l.id && <p className="text-xs text-gray-400">+ {champs.length - 3} autre(s) champ(s)</p>}
            {!modif && ouvert === l.id && champs.map(([k, v]) => <p key={k} className="text-sm"><span className="text-gray-500">{k} :</span> {court(v)}</p>)}
          </div>
        )
      })}
      {pret && !lignes.length && <p className="text-center text-gray-500">Aucune entrée.</p>}
      {lignes.length === 200 && <p className="text-center text-xs text-gray-500">Les 200 entrées les plus récentes sont affichées ; utilisez les filtres pour affiner.</p>}
    </div>
  )
}
