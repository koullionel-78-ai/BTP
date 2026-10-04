// Numéro au format international sans « + » (exigé par wa.me).
// Sans indicatif (8 chiffres locaux, par ex.), on ajoute l'indicatif du pays de l'entreprise.
export function numeroWhatsApp(tel: string | null | undefined, indicatif = '226'): string | null {
  if (!tel) return null
  const brut = tel.trim()
  let d = brut.replace(/\D/g, '')
  if (!d) return null
  if (brut.startsWith('+')) {
    // déjà international
  } else if (d.startsWith('00')) {
    d = d.slice(2)
  } else if (d.length <= 9) {
    d = indicatif + d.replace(/^0+/, '')
  }
  return d.length >= 8 && d.length <= 15 ? d : null
}

export function lienWhatsApp(tel: string | null | undefined, texte: string, indicatif = '226'): string {
  const n = numeroWhatsApp(tel, indicatif)
  return `https://wa.me/${n ?? ''}?text=${encodeURIComponent(texte)}`
}
