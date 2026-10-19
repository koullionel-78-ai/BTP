export const fcfa = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
export const dateFr = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—')

// Date du jour au format AAAA-MM-JJ, à l'heure locale de l'appareil
export const aujourdhui = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// Ajoute n jours à une date AAAA-MM-JJ (calcul en UTC pour éviter les décalages d'heure)
export const ajouterJours = (d: string, n: number) => {
  const x = new Date(d + 'T00:00:00Z')
  x.setUTCDate(x.getUTCDate() + n)
  return x.toISOString().slice(0, 10)
}
// Lundi de la semaine contenant la date
export const lundiDe = (d: string) => {
  const j = new Date(d + 'T00:00:00Z').getUTCDay() // 0 = dimanche
  return ajouterJours(d, -((j + 6) % 7))
}

// Quantité de stock : jusqu'à 2 décimales, séparateurs français
export const qte = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n)
