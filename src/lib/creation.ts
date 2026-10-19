import { supabase } from './supabase'

/** Saisie d'un sous-traitant sur un chantier : un existant, ou un nouveau créé à la volée. */
export interface BrouillonSt {
  stId: string // '' (rien), 'nouveau', ou l'identifiant d'un sous-traitant existant
  nom: string
  specialite: string
  telephone: string
  mission: string
  debut: string
  fin: string
}

export const brouillonStVide = (): BrouillonSt => ({ stId: '', nom: '', specialite: '', telephone: '', mission: '', debut: '', fin: '' })

/** Valide le brouillon ; renvoie un message d'erreur ou null. */
export function verifierBrouillonSt(b: BrouillonSt): string | null {
  if (!b.stId) return 'Choisissez un sous-traitant.'
  if (b.stId === 'nouveau' && !b.nom.trim()) return 'Indiquez le nom du nouveau sous-traitant.'
  if (b.debut && b.fin && b.fin < b.debut) return 'La date de fin doit être après la date de début.'
  return null
}

/** Crée le client s'il est nouveau. Renvoie son identifiant. */
export async function creerClient(c: { nom: string; telephone: string; adresse: string }): Promise<{ id?: string; erreur?: string }> {
  const { data, error } = await supabase.from('clients')
    .insert({ nom: c.nom.trim(), telephone: c.telephone.trim() || null, adresse: c.adresse.trim() || null })
    .select('id').single()
  if (error) return { erreur: error.message }
  return { id: data.id as string }
}

/**
 * Renvoie l'identifiant du sous-traitant du brouillon, en le créant s'il est nouveau.
 * Si un sous-traitant actif porte déjà ce nom, on réutilise celui-là au lieu d'échouer.
 */
export async function idSousTraitant(b: BrouillonSt): Promise<{ id?: string; erreur?: string }> {
  if (b.stId !== 'nouveau') return { id: b.stId }
  const nom = b.nom.trim()
  const { data, error } = await supabase.from('sous_traitants')
    .insert({ nom, specialite: b.specialite.trim() || null, telephone: b.telephone.trim() || null })
    .select('id').single()
  if (!error) return { id: data.id as string }
  if (error.code === '23505') {
    const { data: ex } = await supabase.from('sous_traitants').select('id').eq('actif', true).ilike('nom', nom).limit(1).maybeSingle()
    if (ex) return { id: ex.id as string }
  }
  return { erreur: error.message }
}

/** Affecte un sous-traitant (créé au besoin) à un chantier. */
export async function affecterSousTraitant(chantierId: string, b: BrouillonSt): Promise<string | null> {
  const r = await idSousTraitant(b)
  if (!r.id) return r.erreur ?? 'Erreur inconnue.'
  const { error } = await supabase.from('affectations_st').insert({
    chantier_id: chantierId,
    sous_traitant_id: r.id,
    mission: b.mission.trim() || null,
    date_debut: b.debut || null,
    date_fin: b.fin || null,
  })
  return error ? error.message : null
}
