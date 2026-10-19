import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import SousTraitantSaisie from '../components/SousTraitantSaisie'
import { affecterSousTraitant, brouillonStVide, creerClient, verifierBrouillonSt, type BrouillonSt } from '../lib/creation'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte, champ, etiquette } from '../lib/ui'
import { LIBELLE_STATUT, LIBELLE_TRAVAUX, peutGerer } from '../types'

interface Choix { id: string; nom: string }

export default function ChantierForm() {
  const { id } = useParams()
  const { profil } = useAuth()
  const nav = useNavigate()
  const [clients, setClients] = useState<Choix[]>([])
  const [chefs, setChefs] = useState<Choix[]>([])
  const [personnes, setPersonnes] = useState<Choix[]>([])
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [nouveauClient, setNouveauClient] = useState(false)
  const [cl, setCl] = useState({ nom: '', telephone: '', adresse: '' })
  const [stExistants, setStExistants] = useState<{ id: string; nom: string; specialite: string | null }[]>([])
  const [stListe, setStListe] = useState<BrouillonSt[]>([])
  const [stBrouillon, setStBrouillon] = useState<BrouillonSt>(brouillonStVide())
  const [stErreur, setStErreur] = useState('')
  const [v, setV] = useState({
    titre: '', client_id: '', chef_id: '', controleur_id: '', adresse: '', type_travaux: 'autre',
    date_debut: '', date_fin_prevue: '', budget_prevu: '0', statut: 'a_planifier', avancement_pct: '0',
  })

  useEffect(() => {
    supabase.from('clients').select('id, nom').order('nom').then(({ data }) => setClients(data ?? []))
    supabase.from('profils').select('id, nom').eq('role', 'chef_chantier').eq('actif', true).order('nom')
      .then(({ data }) => setChefs(data ?? []))
    supabase.from('profils').select('id, nom').eq('actif', true).order('nom')
      .then(({ data }) => setPersonnes(data ?? []))
    if (!id) {
      supabase.from('sous_traitants').select('id, nom, specialite').eq('actif', true).order('nom')
        .then(({ data }) => setStExistants((data ?? []) as { id: string; nom: string; specialite: string | null }[]))
    }
    if (id) {
      supabase.from('chantiers').select('*').eq('id', id).maybeSingle().then(({ data }) => {
        if (!data) return
        setV({
          titre: data.titre, client_id: data.client_id ?? '', chef_id: data.chef_id ?? '', controleur_id: data.controleur_id ?? '', adresse: data.adresse ?? '',
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
    // Nouveau client saisi dans le formulaire : on le crée d'abord, puis on le sélectionne
    let clientId = v.client_id
    if (nouveauClient) {
      if (!cl.nom.trim()) { setEnvoi(false); return setErreur('Indiquez le nom du nouveau client.') }
      const r = await creerClient(cl)
      if (!r.id) { setEnvoi(false); return setErreur(r.erreur ?? 'Impossible de créer le client.') }
      clientId = r.id
      // En cas d'échec plus loin, le client existe déjà : on le garde sélectionné pour ne pas le créer deux fois
      setV((x) => ({ ...x, client_id: r.id! }))
      setClients((l) => [...l, { id: r.id!, nom: cl.nom.trim() }])
      setNouveauClient(false)
    }
    const payload = {
      titre: v.titre.trim(),
      client_id: clientId || null,
      chef_id: v.chef_id || null,
      controleur_id: v.controleur_id || null,
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
    if (res.error) { setEnvoi(false); return setErreur(res.error.message) }
    if (!id) {
      const echecs: string[] = []
      for (const b of stListe) {
        const e = await affecterSousTraitant(res.data.id, b)
        if (e) echecs.push(e)
      }
      if (echecs.length) {
        setEnvoi(false)
        return setErreur(`Chantier créé, mais ${echecs.length} sous-traitant(s) n'ont pas pu être affectés (${echecs[0]}). Ajoutez-les depuis la fiche du chantier.`)
      }
    }
    setEnvoi(false)
    nav(`/chantiers/${res.data.id}`)
  }

  return (
    <div className="space-y-3">
      <Link to={id ? `/chantiers/${id}` : '/chantiers'} className="text-sm underline">← Retour</Link>
      <h1 className="text-xl font-bold">{id ? 'Modifier le chantier' : 'Nouveau chantier'}</h1>
      <form onSubmit={soumettre} className={`${carte} space-y-3`}>
        <div><label className={etiquette}>Titre</label><input className={champ} value={v.titre} onChange={maj('titre')} required /></div>
        <div>
          <label className={etiquette}>Client</label>
          <select className={champ} value={nouveauClient ? 'nouveau' : v.client_id}
            onChange={(e) => {
              if (e.target.value === 'nouveau') { setNouveauClient(true); setV({ ...v, client_id: '' }) }
              else { setNouveauClient(false); setV({ ...v, client_id: e.target.value }) }
            }}>
            <option value="">— Aucun —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            <option value="nouveau">+ Nouveau client…</option>
          </select>
          {nouveauClient && (
            <div className="mt-2 space-y-2 rounded-xl border border-dashed border-gray-300 p-3">
              <input className={champ} value={cl.nom} onChange={(e) => setCl({ ...cl, nom: e.target.value })} placeholder="Nom du client" aria-label="Nom du nouveau client" />
              <input className={champ} type="tel" value={cl.telephone} onChange={(e) => setCl({ ...cl, telephone: e.target.value })} placeholder="Téléphone" aria-label="Téléphone du client" />
              <input className={champ} value={cl.adresse} onChange={(e) => setCl({ ...cl, adresse: e.target.value })} placeholder="Adresse du client" aria-label="Adresse du client" />
              <p className="text-xs text-gray-500">Il sera aussi ajouté à la liste Clients.</p>
            </div>
          )}
        </div>
        <div>
          <label className={etiquette}>Chef de chantier</label>
          <select className={champ} value={v.chef_id} onChange={maj('chef_id')}>
            <option value="">— Aucun —</option>
            {chefs.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Un chef a besoin d'un compte pour se connecter. Pas dans la liste ? Créez son compte, puis donnez-lui le rôle « Chef de chantier » dans <Link to="/equipe" className="underline">Équipe</Link>.
          </p>
        </div>
        <div>
          <label className={etiquette}>Contrôleur (suit le chantier, en lecture seule)</label>
          <select className={champ} value={v.controleur_id} onChange={maj('controleur_id')}>
            <option value="">— Aucun —</option>
            {personnes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
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
        {!id && (
          <div className="space-y-2 rounded-xl border border-gray-200 p-3">
            <p className="font-semibold">Sous-traitants (facultatif)</p>
            {stListe.map((b, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-sm">
                <span>{b.stId === 'nouveau' ? `${b.nom.trim()} (nouveau)` : stExistants.find((x) => x.id === b.stId)?.nom}{b.mission && ` · ${b.mission}`}</span>
                <button type="button" className="text-red-600" onClick={() => setStListe(stListe.filter((_, j) => j !== i))}>Retirer</button>
              </div>
            ))}
            <SousTraitantSaisie existants={stExistants} valeur={stBrouillon} onChange={setStBrouillon} />
            {stErreur && <p className="text-sm text-red-600">{stErreur}</p>}
            <button type="button" className={btnSec} onClick={() => {
              const e = verifierBrouillonSt(stBrouillon)
              if (e) return setStErreur(e)
              setStErreur(''); setStListe([...stListe, stBrouillon]); setStBrouillon(brouillonStVide())
            }}>+ Ajouter ce sous-traitant</button>
            <p className="text-xs text-gray-500">Les sous-traitants nouveaux sont créés à l'enregistrement du chantier.</p>
          </div>
        )}
        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
        <button className={btn} disabled={envoi}>{envoi ? 'Patientez…' : 'Enregistrer'}</button>
      </form>
    </div>
  )
}
