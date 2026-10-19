import { ajouterJours } from './format'

export interface ChantierPlan {
  id: string
  titre: string
  statut: string
  chef_id: string | null
  date_debut: string | null
  date_fin_prevue: string | null
}
export interface AffPlan {
  chantier_id: string
  utilisateur_id: string
  date_debut: string | null
  date_fin: string | null
}
export interface AffStPlan {
  chantier_id: string
  sous_traitant_id: string
  date_debut: string | null
  date_fin: string | null
}

export interface Creneau { debut: string; fin: string }

/** Dates d'une affectation : les siennes, sinon celles du chantier. Null si on ne peut pas les connaître. */
export function creneauDe(ch: ChantierPlan, debut: string | null, fin: string | null): Creneau | null {
  const d = debut ?? ch.date_debut
  const f = fin ?? ch.date_fin_prevue
  return d && f ? { debut: d, fin: f } : null
}

/** Créneaux de toutes les personnes (employés, chef compris, et sous-traitants) affectées à un chantier. */
export function creneauxEquipe(ch: ChantierPlan, affs: AffPlan[], affsSt: AffStPlan[]): { creneau: Creneau | null; sousTraitant: boolean; personne: string }[] {
  const employes = affs.filter((a) => a.chantier_id === ch.id)
  const liste = employes.map((a) => ({ creneau: creneauDe(ch, a.date_debut, a.date_fin), sousTraitant: false, personne: a.utilisateur_id }))
  // Le chef de chantier compte comme présent sur toute la durée du chantier, sauf s'il a sa propre affectation datée.
  if (ch.chef_id && !employes.some((a) => a.utilisateur_id === ch.chef_id)) {
    liste.push({ creneau: creneauDe(ch, null, null), sousTraitant: false, personne: ch.chef_id })
  }
  for (const s of affsSt.filter((x) => x.chantier_id === ch.id)) {
    liste.push({ creneau: creneauDe(ch, s.date_debut, s.date_fin), sousTraitant: true, personne: s.sous_traitant_id })
  }
  return liste
}

/**
 * Jours (entre `du` et `au`) où le chantier est ouvert mais où personne n'est affecté.
 * Seuls les chantiers à planifier ou en cours, avec une date de début et une date de fin prévue, sont concernés.
 */
export function joursAPourvoir(ch: ChantierPlan, du: string, au: string, affs: AffPlan[], affsSt: AffStPlan[]): string[] {
  if (ch.statut !== 'a_planifier' && ch.statut !== 'en_cours') return []
  if (!ch.date_debut || !ch.date_fin_prevue) return []
  const debut = ch.date_debut > du ? ch.date_debut : du
  const fin = ch.date_fin_prevue < au ? ch.date_fin_prevue : au
  if (debut > fin) return []
  const equipe = creneauxEquipe(ch, affs, affsSt).map((x) => x.creneau).filter((c): c is Creneau => c !== null)
  const jours: string[] = []
  for (let j = debut; j <= fin; j = ajouterJours(j, 1)) {
    if (!equipe.some((c) => c.debut <= j && c.fin >= j)) jours.push(j)
  }
  return jours
}

const JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
/** « mar. 20/10 » */
export function jourCourt(d: string): string {
  const x = new Date(d + 'T00:00:00Z')
  return `${JOURS_COURTS[x.getUTCDay()]} ${d.slice(8)}/${d.slice(5, 7)}`
}

const JOURS_LONGS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
/** « dimanche 18 octobre 2026 » */
export function jourLong(d: string): string {
  const x = new Date(d + 'T00:00:00Z')
  return `${JOURS_LONGS[x.getUTCDay()]} ${x.getUTCDate()} ${MOIS[x.getUTCMonth()]} ${x.getUTCFullYear()}`
}
