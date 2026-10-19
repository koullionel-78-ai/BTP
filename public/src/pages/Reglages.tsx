import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'
import { btn, carte, champ, etiquette } from '../lib/ui'
import { peutGerer, type Entreprise } from '../types'

export default function Reglages() {
  const { profil } = useAuth()
  const [v, setV] = useState({ nom: '', adresse: '', telephone: '', email: '', identifiants: '', conditions_paiement: '', tva_defaut: '0', indicatif_pays: '226' })
  const [pret, setPret] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('entreprise').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      const e = data as Entreprise | null
      if (e) {
        setV({
          nom: e.nom, adresse: e.adresse ?? '', telephone: e.telephone ?? '', email: e.email ?? '',
          identifiants: e.identifiants ?? '', conditions_paiement: e.conditions_paiement ?? '', tva_defaut: String(e.tva_defaut), indicatif_pays: e.indicatif_pays ?? '226',
        })
      }
      setPret(true)
    })
  }, [])

  if (!peutGerer(profil?.role)) return <p className={carte}>Accès non autorisé.</p>
  const gerant = profil?.role === 'gerant'
  const maj = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value })

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    const tva = Number(v.tva_defaut.replace(',', '.'))
    const { error } = await supabase.from('entreprise').update({
      nom: v.nom.trim() || 'Mon entreprise',
      adresse: v.adresse.trim() || null,
      telephone: v.telephone.trim() || null,
      email: v.email.trim() || null,
      identifiants: v.identifiants.trim() || null,
      conditions_paiement: v.conditions_paiement.trim() || null,
      tva_defaut: Number.isFinite(tva) && tva >= 0 ? tva : 0,
      indicatif_pays: /^[0-9]{1,4}$/.test(v.indicatif_pays.trim()) ? v.indicatif_pays.trim() : '226',
    }).eq('id', 1)
    setMsg(error ? error.message : 'Réglages enregistrés.')
  }

  if (!pret) return <p className="text-center text-gray-500">Chargement…</p>

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Réglages de l'entreprise</h1>
      <p className="text-sm text-gray-500">Ces informations apparaissent en en-tête des devis et des factures.{!gerant && ' Seul le gérant peut les modifier.'}</p>
      <form onSubmit={enregistrer} className={`${carte} space-y-3`}>
        <div><label className={etiquette}>Nom de l'entreprise</label><input className={champ} value={v.nom} onChange={maj('nom')} disabled={!gerant} required /></div>
        <div><label className={etiquette}>Adresse</label><input className={champ} value={v.adresse} onChange={maj('adresse')} disabled={!gerant} /></div>
        <div><label className={etiquette}>Téléphone</label><input className={champ} type="tel" value={v.telephone} onChange={maj('telephone')} disabled={!gerant} /></div>
        <div><label className={etiquette}>E-mail</label><input className={champ} type="email" value={v.email} onChange={maj('email')} disabled={!gerant} /></div>
        <div><label className={etiquette}>Identifiants légaux (IFU, RCCM…)</label><input className={champ} value={v.identifiants} onChange={maj('identifiants')} disabled={!gerant} /></div>
        <div><label className={etiquette}>TVA par défaut (%)</label><input className={champ} inputMode="decimal" value={v.tva_defaut} onChange={maj('tva_defaut')} disabled={!gerant} /></div>
        <div><label className={etiquette}>Indicatif du pays pour WhatsApp (Burkina Faso : 226)</label><input className={champ} inputMode="numeric" value={v.indicatif_pays} onChange={maj('indicatif_pays')} disabled={!gerant} /></div>
        <div><label className={etiquette}>Conditions de paiement (pied de page)</label><textarea className={champ} rows={3} value={v.conditions_paiement} onChange={maj('conditions_paiement')} disabled={!gerant} placeholder="Ex. Acompte de 50 % à la commande, solde à la livraison." /></div>
        {msg && <p className={`text-sm ${msg.startsWith('Réglages') ? 'text-green-700' : 'text-red-600'}`}>{msg}</p>}
        {gerant && <button className={btn}>Enregistrer</button>}
      </form>
    </div>
  )
}
