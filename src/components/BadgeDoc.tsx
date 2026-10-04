import { LIBELLE_DEVIS, LIBELLE_ETAT, type EtatFacture, type StatutDevis } from '../types'

const COULEUR_DEVIS: Record<StatutDevis, string> = {
  brouillon: 'bg-gray-200 text-gray-700',
  envoye: 'bg-blue-100 text-blue-700',
  accepte: 'bg-green-100 text-green-700',
  refuse: 'bg-red-100 text-red-700',
}
const COULEUR_ETAT: Record<EtatFacture, string> = {
  a_encaisser: 'bg-chantier/30 text-nuit',
  echue: 'bg-red-100 text-red-700',
  payee: 'bg-green-100 text-green-700',
  annulee: 'bg-gray-200 text-gray-500',
}
const base = 'rounded-full px-2.5 py-0.5 text-xs font-semibold'

export function BadgeDevis({ statut }: { statut: StatutDevis }) {
  return <span className={`${base} ${COULEUR_DEVIS[statut]}`}>{LIBELLE_DEVIS[statut]}</span>
}
export function BadgeFacture({ etat }: { etat: EtatFacture }) {
  return <span className={`${base} ${COULEUR_ETAT[etat]}`}>{LIBELLE_ETAT[etat]}</span>
}
