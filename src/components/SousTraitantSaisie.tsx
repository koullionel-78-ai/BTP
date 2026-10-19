import { champ, etiquette } from '../lib/ui'
import type { BrouillonSt } from '../lib/creation'

interface Props {
  existants: { id: string; nom: string; specialite: string | null }[]
  valeur: BrouillonSt
  onChange: (v: BrouillonSt) => void
}

/** Champs pour choisir un sous-traitant existant ou en créer un nouveau, avec sa mission et ses dates. */
export default function SousTraitantSaisie({ existants, valeur: v, onChange }: Props) {
  const maj = (k: keyof BrouillonSt, x: string) => onChange({ ...v, [k]: x })
  return (
    <div className="space-y-2">
      <select className={champ} value={v.stId} onChange={(e) => maj('stId', e.target.value)} aria-label="Sous-traitant">
        <option value="">Choisir un sous-traitant…</option>
        {existants.map((s) => <option key={s.id} value={s.id}>{s.nom}{s.specialite ? ` · ${s.specialite}` : ''}</option>)}
        <option value="nouveau">+ Nouveau sous-traitant…</option>
      </select>
      {v.stId === 'nouveau' && (
        <div className="space-y-2 rounded-xl border border-dashed border-gray-300 p-3">
          <input className={champ} value={v.nom} onChange={(e) => maj('nom', e.target.value)} placeholder="Nom du sous-traitant" aria-label="Nom du nouveau sous-traitant" />
          <div className="grid grid-cols-2 gap-2">
            <input className={champ} value={v.specialite} onChange={(e) => maj('specialite', e.target.value)} placeholder="Spécialité" aria-label="Spécialité" />
            <input className={champ} type="tel" value={v.telephone} onChange={(e) => maj('telephone', e.target.value)} placeholder="Téléphone" aria-label="Téléphone" />
          </div>
          <p className="text-xs text-gray-500">Il sera aussi ajouté à la liste Sous-traitants.</p>
        </div>
      )}
      <input className={champ} value={v.mission} onChange={(e) => maj('mission', e.target.value)} placeholder="Mission (ex. Carrelage salle de bain)" aria-label="Mission" />
      <div className="grid grid-cols-2 gap-2">
        <div><label className={etiquette}>Du (facultatif)</label><input className={champ} type="date" value={v.debut} onChange={(e) => maj('debut', e.target.value)} /></div>
        <div><label className={etiquette}>Au (facultatif)</label><input className={champ} type="date" value={v.fin} onChange={(e) => maj('fin', e.target.value)} /></div>
      </div>
    </div>
  )
}
