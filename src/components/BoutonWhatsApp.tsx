import { btnSec } from '../lib/ui'
import { lienWhatsApp } from '../lib/whatsapp'

// Ouvre WhatsApp avec le message déjà rédigé (le PDF se joint à la main dans la conversation).
export default function BoutonWhatsApp({ telephone, texte, indicatif, libelle = 'Envoyer par WhatsApp' }: {
  telephone: string | null | undefined
  texte: string
  indicatif?: string
  libelle?: string
}) {
  return <a className={btnSec} href={lienWhatsApp(telephone, texte, indicatif)} target="_blank" rel="noreferrer">{libelle}</a>
}
