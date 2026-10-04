import type { Ligne } from '../types'

// Même formule que les vues SQL : total TTC = arrondi((brut − remise) × (1 + TVA %))
export function totaux(lignes: Ligne[], remise: number, tvaPct: number) {
  const brut = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0)
  const htExact = brut - remise
  const ttc = Math.round(htExact * (1 + tvaPct / 100))
  const ht = Math.round(htExact)
  return { brut: Math.round(brut), ht, tva: ttc - ht, ttc }
}

export const UNITES = ['m²', 'ml', 'u', 'forfait', 'jour', 'h', 'kg', 'L']
