import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { aujourdhui, dateFr, fcfa } from '../lib/format'
import { lienWhatsApp } from '../lib/whatsapp'
import { nombre } from '../lib/stock'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte, champ, etiquette } from '../lib/ui'
import { LIBELLE_PROSPECT, LIBELLE_SOURCE, peutGerer, type Prospect, type SourceProspect, type StatutProspect } from '../types'

const FILTRES: (StatutProspect | 'tous' | 'en_cours')[] = ['en_cours', 'tous', 'nouveau', 'visite', 'devis_envoye', 'gagne', 'perdu']
const COULEUR: Record<StatutProspect, string> = {
  nouveau: 'bg-blue-100 text-blue-700', visite: 'bg-purple-100 text-purple-700', devis_envoye: 'bg-chantier/30 text-nuit',
  gagne: 'bg-green-100 text-green-700', perdu: 'bg-gray-200 text-gray-600',
}

export default function Prospects() {
  const { profil } = useAuth()
  const nav = useNavigate()
  const [liste, setListe] = useState<Prospect[]>([])
  const [indicatif, setIndicatif] = useState('226')
  const [filtre, setFiltre] = useState<StatutProspect | 'tous' | 'en_cours'>('en_cours')
  const [nouveau, setNouveau] = useState(false)
  const [nom, setNom] = useState(''); const [tel, setTel] = useState(''); const [source, setSource] = useState<SourceProspect>('autre')
  const [demande, setDemande] = useState(''); const [estime, setEstime] = useState('0')
  const [msg, setMsg] = useState('')

  async function charger() {
    const [p, e] = await Promise.all([
      supabase.from('prospects').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('entreprise').select('indicatif_pays').eq('id', 1).maybeSingle(),
    ])
    if (p.error) setMsg(p.error.message)
    setListe((p.data ?? []) as Prospect[])
    if (e.data?.indicatif_pays) setIndicatif(e.data.indicatif_pays as string)
  }
  useEffect(() => { void charger() }, [])

  if (!peutGerer(profil?.role)) return <p className={carte}>Accès non autorisé.</p>

  const gagnes = liste.filter((p) => p.statut === 'gagne').length
  const perdus = liste.filter((p) => p.statut === 'perdu').length
  const decides = gagnes + perdus
  const enCours = liste.filter((p) => !['gagne', 'perdu'].includes(p.statut))
  const pipeline = enCours.reduce((s, p) => s + p.montant_estime, 0)

  async function ajouter(e: FormEvent) {
    e.preventDefault()
    const m = nombre(estime)
    if (Number.isNaN(m) || m < 0 || !Number.isInteger(m)) return setMsg('Le montant estimé doit être un entier positif ou nul.')
    const { error } = await supabase.from('prospects').insert({ nom: nom.trim(), telephone: tel.trim() || null, source, demande: demande.trim() || null, montant_estime: m })
    if (error) return setMsg(error.message)
    setNom(''); setTel(''); setDemande(''); setEstime('0'); setNouveau(false); setMsg('')
    await charger()
  }

  async function changerStatut(p: Prospect, statut: StatutProspect) {
    const champs: Record<string, unknown> = { statut }
    if (statut === 'visite' && !p.date_visite) champs.date_visite = aujourdhui()
    if (statut === 'perdu') {
      const raison = prompt('Pourquoi cette demande est-elle perdue ? (facultatif)', p.raison_perte ?? '')
      if (raison === null) return
      champs.raison_perte = raison.trim() || null
    }
    const { error } = await supabase.from('prospects').update(champs).eq('id', p.id)
    setMsg(error ? error.message : '')
    await charger()
  }

  async function convertir(p: Prospect) {
    if (!confirm(`Créer le client « ${p.nom} » à partir de ce prospect ?`)) return
    const { data, error } = await supabase.rpc('convertir_prospect', { p_id: p.id })
    if (error) return setMsg(error.message)
    nav(`/clients/${data as string}`)
  }

  async function supprimer(p: Prospect) {
    if (!confirm(`Supprimer le prospect « ${p.nom} » ?`)) return
    const { error } = await supabase.from('prospects').delete().eq('id', p.id)
    setMsg(error ? error.message : '')
    await charger()
  }

  const affiches = liste.filter((p) => (filtre === 'tous' ? true : filtre === 'en_cours' ? !['gagne', 'perdu'].includes(p.statut) : p.statut === filtre))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Prospects</h1>
        <button className={nouveau ? btnSec : btn} onClick={() => setNouveau(!nouveau)}>{nouveau ? 'Annuler' : 'Nouveau'}</button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className={carte}><p className="text-xs text-gray-500">En cours</p><p className="text-lg font-bold">{enCours.length}</p></div>
        <div className={carte}><p className="text-xs text-gray-500">Potentiel</p><p className="text-sm font-bold">{fcfa(pipeline)}</p></div>
        <div className={carte}><p className="text-xs text-gray-500">Conversion</p><p className="text-lg font-bold">{decides ? `${Math.round((gagnes / decides) * 100)} %` : '—'}</p></div>
      </div>
      {decides > 0 && <p className="text-xs text-gray-500">Conversion = gagnés / (gagnés + perdus) : {gagnes} gagné{gagnes > 1 ? 's' : ''}, {perdus} perdu{perdus > 1 ? 's' : ''}.</p>}
      {nouveau && (
        <form onSubmit={ajouter} className={`${carte} space-y-3`}>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={etiquette}>Nom</label><input className={champ} value={nom} onChange={(e) => setNom(e.target.value)} required /></div>
            <div><label className={etiquette}>Téléphone</label><input className={champ} type="tel" value={tel} onChange={(e) => setTel(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={etiquette}>Origine de la demande</label>
              <select className={champ} value={source} onChange={(e) => setSource(e.target.value as SourceProspect)}>
                {Object.entries(LIBELLE_SOURCE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div><label className={etiquette}>Montant estimé (FCFA)</label><input className={champ} inputMode="numeric" value={estime} onChange={(e) => setEstime(e.target.value)} /></div>
          </div>
          <div><label className={etiquette}>Demande</label><textarea className={champ} rows={2} value={demande} onChange={(e) => setDemande(e.target.value)} placeholder="Ex. Peinture d'une villa de 4 chambres" /></div>
          <button className={btn}>Enregistrer</button>
        </form>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTRES.map((f) => (
          <button key={f} onClick={() => setFiltre(f)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${filtre === f ? 'bg-nuit text-white' : 'bg-white'}`}>
            {f === 'tous' ? 'Tous' : f === 'en_cours' ? 'En cours' : LIBELLE_PROSPECT[f]}
          </button>
        ))}
      </div>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      {affiches.map((p) => (
        <div key={p.id} className={`${carte} space-y-2`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{p.nom}</p>
              <p className="text-sm text-gray-500">{LIBELLE_SOURCE[p.source]} · contact le {dateFr(p.date_contact)}{p.date_visite && ` · visite le ${dateFr(p.date_visite)}`}</p>
            </div>
            <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${COULEUR[p.statut]}`}>{LIBELLE_PROSPECT[p.statut]}</span>
          </div>
          {p.demande && <p className="text-sm">{p.demande}</p>}
          {p.montant_estime > 0 && <p className="text-sm text-gray-600">Estimé : <b>{fcfa(p.montant_estime)}</b></p>}
          {p.raison_perte && <p className="text-sm text-gray-500">Raison : {p.raison_perte}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <select className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm" value={p.statut} onChange={(e) => void changerStatut(p, e.target.value as StatutProspect)} aria-label="Statut">
              {Object.entries(LIBELLE_PROSPECT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            {p.telephone && <a className="text-sm underline" href={lienWhatsApp(p.telephone, `Bonjour ${p.nom}, `, indicatif)} target="_blank" rel="noreferrer">WhatsApp</a>}
            {p.client_id ? <Link className="text-sm underline" to={`/clients/${p.client_id}`}>Voir le client</Link>
              : <button className="text-sm underline" onClick={() => void convertir(p)}>Créer le client</button>}
            {!p.client_id && <Link className="text-sm underline" to="/devis/nouveau">Devis</Link>}
            <button className="ml-auto text-sm text-red-600" onClick={() => void supprimer(p)}>Supprimer</button>
          </div>
        </div>
      ))}
      {!affiches.length && <p className="text-center text-gray-500">Aucun prospect dans ce filtre.</p>}
    </div>
  )
}
