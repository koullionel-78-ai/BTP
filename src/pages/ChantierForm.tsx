import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'
import { btn, carte, champ, etiquette } from '../lib/ui'
import { LIBELLE_STATUT, LIBELLE_TRAVAUX, peutGerer } from '../types'

interface Choix { id: string; nom: string }

export default function ChantierForm() {
  const { id } = useParams()
  const { profil } = useAuth()
  const nav = useNavigate()
  const [clients, setClients] = useState<Choix[]>([])
  const [chefs, setChefs] = useState<Choix[]>([])
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [v, setV] = useState({
    titre: '', client_id: '', chef_id: '', adresse: '', type_travaux: 'autre',
    date_debut: '', date_fin_prevue: '', budget_prevu: '0', statut: 'a_planifier', avancement_pct: '0',
  })

  useEffect(() => {
    supabase.from('clients').select('id, nom').order('nom').then(({ data }) => setClients(data ?? []))
    supabase.from('profils').select('id, nom').eq('role', 'chef_chantier').eq('actif', true).order('nom')
      .then(({ data }) => setChefs(data ?? []))
    if (id) {
      supabase.from('chantiers').select('*').eq('id', id).maybeSingle().then(({ data }) => {
        if (!data) return
        setV({
          titre: data.titre, client_id: data.client_id ?? '', chef_id: data.chef_id ?? '', adresse: data.adresse ?? '',
          type_travaux: data.type_travaux, date_debut: data.date_debut ?? '', date_fin_prevue: data.date_fin_prevue ?? '',
          budget_prevu: String(data.budget_prevu), statut: data.statut, avancement_pct: String(data.avancement_pct),
        })
      })
    }
  }, [id])

  if (!peutGerer(profil?.role)) return <p className={carte}>Accès non autorisé.</p>

  const maj = (k: keyof typeof v) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV({ ...v, [k]: e.target.value })

  async function soumettre(e: FormEvent) {
    e.preventDefault()
    setEnvoi(true)
    setErreur('')
    const payload = {
      titre: v.titre.trim(),
      client_id: v.client_id || null,
      chef_id: v.chef_id || null,
      adresse: v.adresse.trim() || null,
      type_travaux: v.type_travaux,
      date_debut: v.date_debut || null,
      date_fin_prevue: v.date_fin_prevue || null,
      budget_prevu: Number(v.budget_prevu) || 0,
      statut: v.statut,
      avancement_pct: Math.min(100, Math.max(0, Number(v.avancement_pct) || 0)),
    }
    const res = id
      ? await supabase.from('chantiers').update(payload).eq('id', id).select('id').single()
      : await supabase.from('chantiers').insert(payload).select('id').single()
    setEnvoi(false)
    if (res.error) setErreur(res.error.message)
    else nav(`/chantiers/${res.data.id}`)
  }

  return (
    <div className="space-y-3">
      <Link to={id ? `/chantiers/${id}` : '/chantiers'} className="text-sm underline">← Retour</Link>
      <h1 className="text-xl font-bold">{id ? 'Modifier le chantier' : 'Nouveau chantier'}</h1>
      <form onSubmit={soumettre} className={`${carte} space-y-3`}>
        <div><label className={etiquette}>Titre</label><input className={champ} value={v.titre} onChange={maj('titre')} required /></div>
        <div>
          <label className={etiquette}>Client</label>
          <select className={champ} value={v.client_id} onChange={maj('client_id')}>
            <option value="">— Aucun —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>
        <div>
          <label className={etiquette}>Chef de chantier</label>
          <select className={champ} value={v.chef_id} onChange={maj('chef_id')}>
            <option value="">— Aucun —</option>
            {chefs.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>
        <div><label className={etiquette}>Adresse</label><input className={champ} value={v.adresse} onChange={maj('adresse')} /></div>
        <div>
          <label className={etiquette}>Type de travaux</label>
          <select className={champ} value={v.type_travaux} onChange={maj('type_travaux')}>
            {Object.entries(LIBELLE_TRAVAUX).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={etiquette}>Début</label><input className={champ} type="date" value={v.date_debut} onChange={maj('date_debut')} /></div>
          <div><label className={etiquette}>Fin prévue</label><input className={champ} type="date" value={v.date_fin_prevue} onChange={maj('date_fin_prevue')} /></div>
        </div>
        <div><label className={etiquette}>Budget prévu (FCFA)</label><input className={champ} type="number" min="0" value={v.budget_prevu} onChange={maj('budget_prevu')} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={etiquette}>Statut</label>
            <select className={champ} value={v.statut} onChange={maj('statut')}>
              {Object.entries(LIBELLE_STATUT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div><label className={etiquette}>Avancement (%)</label><input className={champ} type="number" min="0" max="100" value={v.avancement_pct} onChange={maj('avancement_pct')} /></div>
        </div>
        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
        <button className={btn} disabled={envoi}>{envoi ? 'Patientez…' : 'Enregistrer'}</button>
      </form>
    </div>
  )
}
