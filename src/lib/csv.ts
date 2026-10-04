// Export CSV lisible par Excel en français : séparateur « ; », BOM UTF-8, décimales avec virgule.
function cellule(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function telechargerCsv(nom: string, colonnes: { titre: string; cle: string }[], lignes: Record<string, unknown>[]) {
  const entete = colonnes.map((c) => cellule(c.titre)).join(';')
  const corps = lignes.map((l) => colonnes.map((c) => cellule(l[c.cle])).join(';'))
  const blob = new Blob(['\uFEFF' + [entete, ...corps].join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nom
  a.click()
  URL.revokeObjectURL(url)
}
