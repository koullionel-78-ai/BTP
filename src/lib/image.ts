// Réduit la taille d'une photo avant envoi (économise les données mobiles).
export async function compresser(fichier: File, max = 1600, qualite = 0.8): Promise<Blob> {
  const bmp = await createImageBitmap(fichier)
  const ratio = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * ratio)
  canvas.height = Math.round(bmp.height * ratio)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((ok, ko) =>
    canvas.toBlob((b) => (b ? ok(b) : ko(new Error('Compression impossible'))), 'image/jpeg', qualite),
  )
}
