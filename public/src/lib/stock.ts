export const UNITES_STOCK = ['u', 'kg', 'L', 'sac', 'seau', 'pot', 'rouleau', 'boîte', 'm²', 'ml']

// Quantité lisible : 12 ou 12,5 (jamais 12,00)
export const qte = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n)

export const nombre = (s: string) => {
  const n = Number(s.trim().replace(',', '.'))
  return s.trim() !== '' && Number.isFinite(n) ? n : NaN
}
