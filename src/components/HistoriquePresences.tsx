import { useCallback, useEffect, useMemo, useState } from 'react'
import { aujourdhui } from '../lib/format'
import { jourLong } from '../lib/planning'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte, champ } from '../lib/ui'

interface Props {
  chantierId: string
  /** Peut pointer et supprimer des présences de sous-traitants. */
  peutPointer: boolean
  /** Sous-traitants affectés au chantier (pour le pointage). */
  externes: { id: string; nom: string }[]
}

interface Jour { date: string; employes: string[]; sousTraitants: { id: string; nom: string; note: string | null }[] }

const MAX_JOURS = 15

export default function HistoriquePresences({ chantierId, peutPointer, externes }: Props) {
  const [jours, setJours] = useState<Jour[]>([])
  const [toutVoir, setToutVoir] = useState(false)
  const [stId, setStId] = useState('')
  const [date, setDate] = useState(aujourdhui())
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')
  const [pret, setPret] = useState(false)

  const charger = useCallback(async () => {
    const [emp, st] = await Promise.all([
      supabase.from('rapport_presences').select('profils(nom), rapports!inner(date_rapport, chantier_id)').eq('rapports.chantier_id', chantierId),
      supabase.from('presences_st').select('id, date_presence, note, sous_traitant_id, sous_traitants(nom)').eq('chantier_id', chantierId),
    ])
    const par = new Map<string, Jour>()
    const jour = (d: string) => {
      if (!par.has(d)) par.set(d, { date: d, employes: [], sousTraitants: [] })
      return par.get(d)!
    }
    for (const p of ((emp.error ? [] : emp.data ?? []) as unknown as { profils: { nom: string } | null; rapports: { date_rapport: string } }[])) {
      if (p.profils?.nom) jour(p.rapports.date_rapport).employes.push(p.profils.nom)
    }
    for (const p of ((st.error ? [] : st.data ?? []) as unknown as { id: string; date_presence: string; note: string | null; sous_traitants: { nom: string } | null }[])) {
      jour(p.date_presence).sousTraitants.push({ id: p.id, nom: p.sous_traitants?.nom ?? 'Sous-traitant', note: p.note })
    }
    for (const j of par.values()) { j.employes.sort((a, b) => a.localeCompare(b, 'fr')); j.sousTraitants.sort((a, b) => a.nom.localeCompare(b.nom, 'fr')) }
    setJours([...par.values()].sort((a, b) => b.date.localeCompare(a.date)))
    setPret(true)
  }, [chantierId])

  useEffect(() => { void charger() }, [charger])

  async function pointer() {
    if (!stId) return setMsg('Choisissez un sous-traitant.')
    if (date > aujourdhui()) return setMsg('Vous ne pouvez pas pointer une date à venir.')
    const { error } = await supabase.from('presences_st').insert({ chantier_id: chantierId, sous_traitant_id: stId, date_presence: date, note: note.trim() || null })
    if (error) return setMsg(error.code === '23505' ? 'Ce sous-traitant est déjà pointé ce jour-là.' : error.message)
    setMsg(''); setNote('')
    await charger()
  }

  async function supprimer(id: string) {
    if (!confirm('Supprimer ce pointage ?')) return
    const { error } = await supabase.from('presences_st').delete().eq('id', id)
    setMsg(error ? error.message : '')
    await charger()
  }

  const affiches = useMemo(() => (toutVoir ? jours : jours.slice(0, MAX_JOURS)), [jours, toutVoir])
  if (!pret) return null
  if (!peutPointer && !jours.length) return null

  return (
    <div className={`${carte} space-y-3`}>
      <h2 className="font-bold">Historique de présence</h2>
      {peutPointer && (
        <div className="space-y-2 rounded-xl border border-gray-200 p-3">
          <p className="text-sm font-semibold text-gray-600">Pointer un sous-traitant</p>
          {externes.length ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <select className={champ} value={stId} onChange={(e) => setStId(e.target.value)} aria-label="Sous-traitant présent">
                  <option value="">Qui ?</option>
                  {externes.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
                <input className={champ} type="date" value={date} max={aujourdhui()} onChange={(e) => setDate(e.target.value)} aria-label="Jour de présence" />
              </div>
              <input className={champ} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (facultatif) : travail fait ce jour-là" />
              <div className="flex gap-2">
                <button className={btn} onClick={() => void pointer()}>Pointer</button>
                {date !== aujourdhui() && <button className={btnSec} onClick={() => setDate(aujourdhui())}>Aujourd'hui</button>}
              </div>
            </>
          ) : <p className="text-sm text-gray-500">Affectez d'abord un sous-traitant au chantier pour pouvoir le pointer.</p>}
        </div>
      )}
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      {affiches.map((j) => (
        <div key={j.date} className="space-y-1 border-t border-gray-100 pt-2 text-sm">
          <p className="font-semibold">{jourLong(j.date)}</p>
          {j.employes.length > 0 && <p><span className="text-gray-500">Équipe : </span>{j.employes.join(', ')}</p>}
          {j.sousTraitants.map((s) => (
            <p key={s.id} className="flex items-start justify-between gap-2">
              <span><span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold">Sous-traitant</span> {s.nom}{s.note && <span className="text-gray-500"> · {s.note}</span>}</span>
              {peutPointer && <button className="whitespace-nowrap text-red-600" onClick={() => void supprimer(s.id)}>Retirer</button>}
            </p>
          ))}
        </div>
      ))}
      {!jours.length && <p className="text-sm text-gray-500">Aucune présence enregistrée. L'équipe y apparaît via les rapports journaliers ; les sous-traitants via le pointage.</p>}
      {jours.length > MAX_JOURS && (
        <button className="text-sm underline" onClick={() => setToutVoir(!toutVoir)}>{toutVoir ? 'Réduire' : `Voir les ${jours.length} jours`}</button>
      )}
    </div>
  )
}
