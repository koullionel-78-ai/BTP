import { LIBELLE_STATUT, type StatutChantier } from '../types'

const COULEUR: Record<StatutChantier, string> = {
  a_planifier: 'bg-gray-200 text-gray-700',
  en_cours: 'bg-chantier/30 text-nuit',
  en_pause: 'bg-orange-100 text-orange-700',
  termine: 'bg-green-100 text-green-700',
  annule: 'bg-red-100 text-red-700',
}

export default function Badge({ statut }: { statut: StatutChantier }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${COULEUR[statut]}`}>{LIBELLE_STATUT[statut]}</span>
}
