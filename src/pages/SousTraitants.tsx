import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { jourLong } from '../lib/planning'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte, champ, etiquette } from '../lib/ui'
import { peutGerer, type SousTraitant } from '../types'

const CRITERES: { cle: 'qualite' | 'delais' | 'prix'; libelle: string }[] = [
  { cle: 'qualite', libelle: 'Qualité du travail' },
  { cle: 'delais', libelle: 'Respect des délais' },
  { cle: 'prix', libelle: 'Prix (5 = très bon rapport)' },
]

const etoiles = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('fr-FR')} / 5`)

export default function SousTraitants() {
  const { profil } = useAuth()
  const [liste, setListe] = useState<SousTraitant[]>([])
  const [chantiers, setChantiers] = useState<{ id: string; titre: string }[]>([])
  const [nouveau, setNouveau] = useState(false)
  const [nom, setNom] = useState(''); const [specialite, setSpecialite] = useState(''); const [tel, setTel] = useState('')
  const [evalId, setEvalId] = useState<string | null>(null)
  const [notes, setNotes] = useState({ qualite: 3, delais: 3, prix: 3 })
  const [evalChantier, setEvalChantier] = useState(''); const [commentaire, setCommentaire] = useState('')
  const [msg, setMsg] = useState('')
  const [histoId, setHistoId] = useState<string | null>(null)
  const [histo, setHisto] = useState<{ id: string; date_presence: string; note: string | null; chantiers: { titre: string } | null }[] | null>(null)

  async function charger() {
    const [s, c] = await Promise.all([
      supabase.from('sous_traitants_notes').select('*').eq('actif', true).order('nom'),
      supabase.from('chantiers').select('id, titre').order('titre'),
    ])
    if (s.error) setMsg(s.error.message)
    setListe((s.data ?? []) as SousTraitant[])
    setChantiers((c.data ?? []) as { id: string; titre: string }[])
  }
  useEffect(() => { void charger() }, [])

  if (!peutGerer(profil?.role)) return <p className={carte}>Accès non autorisé.</p>

  async function ajouter(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('sous_traitants').insert({ nom: nom.trim(), specialite: specialite.trim() || null, telephone: tel.trim() || null })
    if (error) return setMsg(error.code === '23505' ? 'Un sous-traitant porte déjà ce nom.' : error.message)
    setNom(''); setSpecialite(''); setTel(''); setNouveau(false); setMsg('')
    await charger()
  }

  async function evaluer(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('evaluations_st').insert({ sous_traitant_id: evalId, chantier_id: evalChantier || null, ...notes, commentaire: commentaire.trim() || null })
    if (error) return setMsg(error.message)
    setEvalId(null); setCommentaire(''); setEvalChantier(''); setNotes({ qualite: 3, delais: 3, prix: 3 }); setMsg('')
    await charger()
  }

  async function voirHistorique(sid: string) {
    if (histoId === sid) { setHistoId(null); return }
    setHistoId(sid); setHisto(null)
    const { data, error } = await supabase.from('presences_st').select('id, date_presence, note, chantiers(titre)')
      .eq('sous_traitant_id', sid).order('date_presence', { ascending: false }).limit(200)
    if (error) { setMsg(error.message); setHistoId(null); return }
    setHisto((data ?? []) as unknown as { id: string; date_presence: string; note: string | null; chantiers: { titre: string } | null }[])
  }

  async function retirer(s: SousTraitant) {
    if (!confirm(`Retirer ${s.nom} de la liste ? Ses évaluations sont conservées.`)) return
    const { error } = await supabase.from('sous_traitants').update({ actif: false }).eq('id', s.id)
    setMsg(error ? error.message : '')
    await charger()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Sous-traitants</h1>
        <button className={nouveau ? btnSec : btn} onClick={() => setNouveau(!nouveau)}>{nouveau ? 'Annuler' : 'Nouveau'}</button>
      </div>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      {nouveau && (
        <form onSubmit={ajouter} className={`${carte} space-y-3`}>
          <div><label className={etiquette}>Nom</label><input className={champ} value={nom} onChange={(e) => setNom(e.target.value)} required /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={etiquette}>Spécialité</label><input className={champ} value={specialite} onChange={(e) => setSpecialite(e.target.value)} placeholder="Ex. Électricité" /></div>
            <div><label className={etiquette}>Téléphone</label><input className={champ} type="tel" value={tel} onChange={(e) => setTel(e.target.value)} /></div>
          </div>
          <button className={btn}>Ajouter</button>
        </form>
      )}
      {liste.map((s) => (
        <div key={s.id} className={`${carte} space-y-2`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{s.nom}</p>
              <p className="text-sm text-gray-500">{[s.specialite, s.telephone].filter(Boolean).join(' · ') || '—'}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">{etoiles(s.note_globale)}</p>
              <p className="text-xs text-gray-500">{s.nb_evaluations} évaluation{s.nb_evaluations > 1 ? 's' : ''}</p>
            </div>
          </div>
          {s.nb_evaluations > 0 && (
            <p className="text-sm text-gray-600">Qualité {etoiles(s.qualite_moy)} · Délais {etoiles(s.delais_moy)} · Prix {etoiles(s.prix_moy)}</p>
          )}
          {evalId === s.id ? (
            <form onSubmit={evaluer} className="space-y-3 border-t border-gray-100 pt-3">
              {CRITERES.map((c) => (
                <div key={c.cle}>
                  <label className={etiquette}>{c.libelle} : {notes[c.cle]} / 5</label>
                  <input type="range" min={1} max={5} step={1} value={notes[c.cle]} onChange={(e) => setNotes({ ...notes, [c.cle]: Number(e.target.value) })} className="w-full accent-chantier" />
                </div>
              ))}
              <select className={champ} value={evalChantier} onChange={(e) => setEvalChantier(e.target.value)} aria-label="Chantier concerné">
                <option value="">Chantier concerné (facultatif)</option>
                {chantiers.map((c) => <option key={c.id} value={c.id}>{c.titre}</option>)}
              </select>
              <input className={champ} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Commentaire (facultatif)" />
              <div className="flex gap-2"><button className={btn}>Enregistrer l'évaluation</button><button type="button" className={btnSec} onClick={() => setEvalId(null)}>Annuler</button></div>
            </form>
          ) : (
            <div className="flex items-center gap-3">
              <button className={btnSec} onClick={() => setEvalId(s.id)}>Évaluer</button>
              <button className="text-sm underline" onClick={() => void voirHistorique(s.id)}>{histoId === s.id ? 'Masquer l\'historique' : 'Historique'}</button>
              <button className="text-sm text-red-600" onClick={() => void retirer(s)}>Retirer</button>
            </div>
          )}
          {histoId === s.id && (
            <div className="space-y-1 border-t border-gray-100 pt-2 text-sm">
              {histo === null && <p className="text-gray-500">Chargement…</p>}
              {histo?.map((h) => (
                <p key={h.id}><b>{jourLong(h.date_presence)}</b> · {h.chantiers?.titre ?? 'Chantier'}{h.note && <span className="text-gray-500"> · {h.note}</span>}</p>
              ))}
              {histo && !histo.length && <p className="text-gray-500">Aucune présence pointée pour l'instant.</p>}
              {histo && <p className="text-xs text-gray-500">{histo.length} jour{histo.length > 1 ? 's' : ''} de présence enregistré{histo.length > 1 ? 's' : ''}.</p>}
            </div>
          )}
        </div>
      ))}
      {!liste.length && <p className="text-center text-gray-500">Aucun sous-traitant.</p>}
    </div>
  )
}
