import { useState, type ChangeEvent, type FormEvent } from 'react'
import { btn, champ, etiquette } from '../lib/ui'
import type { Client } from '../types'

export type ClientSaisie = Pick<Client, 'nom' | 'telephone' | 'email' | 'adresse' | 'notes'>

interface Props {
  initial?: ClientSaisie
  libelle: string
  desactive?: boolean
  onSubmit: (v: ClientSaisie) => Promise<string | null>
}

export default function ClientForm({ initial, libelle, desactive, onSubmit }: Props) {
  const [v, setV] = useState({
    nom: initial?.nom ?? '',
    telephone: initial?.telephone ?? '',
    email: initial?.email ?? '',
    adresse: initial?.adresse ?? '',
    notes: initial?.notes ?? '',
  })
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const maj = (k: keyof typeof v) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV({ ...v, [k]: e.target.value })

  async function soumettre(e: FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    const err = await onSubmit({
      nom: v.nom.trim(),
      telephone: v.telephone.trim() || null,
      email: v.email.trim() || null,
      adresse: v.adresse.trim() || null,
      notes: v.notes.trim() || null,
    })
    setErreur(err ?? '')
    setEnvoi(false)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <div><label className={etiquette}>Nom</label><input className={champ} value={v.nom} onChange={maj('nom')} required disabled={desactive} /></div>
      <div><label className={etiquette}>Téléphone</label><input className={champ} type="tel" value={v.telephone} onChange={maj('telephone')} disabled={desactive} /></div>
      <div><label className={etiquette}>E-mail</label><input className={champ} type="email" value={v.email} onChange={maj('email')} disabled={desactive} /></div>
      <div><label className={etiquette}>Adresse</label><input className={champ} value={v.adresse} onChange={maj('adresse')} disabled={desactive} /></div>
      <div><label className={etiquette}>Notes</label><textarea className={champ} rows={3} value={v.notes} onChange={maj('notes')} disabled={desactive} /></div>
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {!desactive && <button className={btn} disabled={envoi}>{envoi ? 'Patientez…' : libelle}</button>}
    </form>
  )
}
