import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { aujourdhui } from '../lib/format'
import { supabase } from '../lib/supabase'
import { btn, carte, champ, etiquette } from '../lib/ui'
import { peutGerer, type Rapport } from '../types'

interface ChantierChoix { id: string; titre: string; avancement_pct: number; chef_id: string | null; statut: string }
interface Personne { id: string; nom: string }

export default function RapportForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { profil, session } = useAuth()
  const [chantiers, setChantiers] = useState<ChantierChoix[]>([])
  const [personnes, setPersonnes] = useState<Personne[]>([])
  const [chantierId, setChantierId] = useState(params.get('chantier') ?? '')
  const [date, setDate] = useState(aujourdhui())
  const [pct, setPct] = useState('0')
  const [travaux, setTravaux] = useState('')
  const [incident, setIncident] = useState('')
  const [presents, setPresents] = useState<string[]>([])
  const [avant, setAvant] = useState<string[]>([]) // présents enregistrés (mode modification)
  const [pret, setPret] = useState(false)
  const [interdit, setInterdit] = useState('')
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)

  const peutEcrire = peutGerer(profil?.role) || profil?.role === 'chef_chantier'

  useEffect(() => {
    void (async () => {
      const [c, p] = await Promise.all([
        supabase.from('chantiers').select('id, titre, avancement_pct, chef_id, statut').in('statut', ['a_planifier', 'en_cours', 'en_pause']).order('titre'),
        supabase.from('profils').select('id, nom').eq('actif', true).in('role', ['ouvrier', 'chef_chantier']).order('nom'),
      ])
      setPersonnes((p.data ?? []) as Personne[])
      setChantiers((c.data ?? []) as ChantierChoix[])
      if (id) {
        const [r, pr] = await Promise.all([
          supabase.from('rapports').select('*').eq('id', id).maybeSingle(),
          supabase.from('rapport_presences').select('utilisateur_id').eq('rapport_id', id),
        ])
        const rap = r.data as Rapport | null
        if (!rap) return setInterdit('Rapport introuvable.')
        if (!peutGerer(profil?.role) && rap.auteur_id !== session?.user.id) return setInterdit('Vous ne pouvez modifier que vos propres rapports.')
        const ids = (pr.data ?? []).map((x) => x.utilisateur_id as string)
        setChantierId(rap.chantier_id)
        setDate(rap.date_rapport)
        setPct(String(rap.avancement_pct))
        setTravaux(rap.travaux)
        setIncident(rap.incident ?? '')
        setPresents(ids)
        setAvant(ids)
        // le chantier du rapport doit rester sélectionnable même s'il est terminé
        if (!(c.data ?? []).some((x) => x.id === rap.chantier_id)) {
          const { data } = await supabase.from('chantiers').select('id, titre, avancement_pct, chef_id, statut').eq('id', rap.chantier_id).maybeSingle()
          if (data) setChantiers((l) => [...l, data as ChantierChoix])
        }
      }
      setPret(true)
    })()
  }, [id])

  // Nouveau rapport : choisir un chantier reprend son avancement et son équipe affectée
  async function choisirChantier(cid: string) {
    setChantierId(cid)
    if (id || !cid) return
    const ch = chantiers.find((x) => x.id === cid)
    if (ch) setPct(String(ch.avancement_pct))
    const { data } = await supabase.from('affectations').select('utilisateur_id').eq('chantier_id', cid)
    const equipe = (data ?? []).map((x) => x.utilisateur_id as string)
    if (ch?.chef_id && !equipe.includes(ch.chef_id)) equipe.push(ch.chef_id)
    setPresents(equipe.filter((u) => personnes.some((p) => p.id === u)))
  }

  useEffect(() => {
    if (pret && !id && chantierId) void choisirChantier(chantierId)
  }, [pret])

  if (!peutEcrire) return <p className={carte}>Seuls le gérant, la secrétaire et les chefs de chantier peuvent écrire un rapport.</p>
  if (interdit) return <p className={carte}>{interdit}</p>
  if (!pret) return <p className="text-center text-gray-500">Chargement…</p>

  const basculer = (uid: string) => setPresents(presents.includes(uid) ? presents.filter((x) => x !== uid) : [...presents, uid])
  const chantiersProposes = profil?.role === 'chef_chantier' ? chantiers.filter((c) => c.chef_id === session?.user.id) : chantiers

  async function soumettre(e: FormEvent) {
    e.preventDefault()
    const n = Math.round(Number(pct))
    if (!chantierId) return setErreur('Choisissez un chantier.')
    if (!Number.isFinite(n) || n < 0 || n > 100) return setErreur("L'avancement doit être entre 0 et 100 %.")
    if (date > aujourdhui()) return setErreur('La date ne peut pas être dans le futur.')
    setEnvoi(true)
    setErreur('')
    const champs = { date_rapport: date, avancement_pct: n, travaux: travaux.trim(), incident: incident.trim() || null }
    let rapportId = id
    if (id) {
      const { error } = await supabase.from('rapports').update({ ...champs, chantier_id: chantierId }).eq('id', id)
      if (error) { setEnvoi(false); return setErreur(messageErreur(error)) }
    } else {
      const { data, error } = await supabase.from('rapports').insert({ ...champs, chantier_id: chantierId }).select('id').single()
      if (error) { setEnvoi(false); return setErreur(messageErreur(error)) }
      rapportId = data.id as string
    }
    if (presents.length) {
      const { error } = await supabase.from('rapport_presences').upsert(
        presents.map((u) => ({ rapport_id: rapportId, utilisateur_id: u })), { onConflict: 'rapport_id,utilisateur_id' })
      if (error) { setEnvoi(false); return setErreur('Rapport enregistré, mais les présents ont échoué : ' + error.message) }
    }
    const retires = avant.filter((u) => !presents.includes(u))
    if (retires.length) await supabase.from('rapport_presences').delete().eq('rapport_id', rapportId!).in('utilisateur_id', retires)
    nav(`/rapports/${rapportId}`)
  }

  return (
    <div className="space-y-3">
      <Link to={id ? `/rapports/${id}` : '/rapports'} className="text-sm underline">← Retour</Link>
      <h1 className="text-xl font-bold">{id ? 'Modifier le rapport' : 'Rapport journalier'}</h1>
      <form onSubmit={soumettre} className={`${carte} space-y-3`}>
        <div>
          <label className={etiquette}>Chantier</label>
          <select className={champ} value={chantierId} onChange={(e) => void choisirChantier(e.target.value)} required>
            <option value="">Choisir un chantier…</option>
            {chantiersProposes.map((c) => <option key={c.id} value={c.id}>{c.titre}</option>)}
          </select>
        </div>
        <div>
          <label className={etiquette}>Date</label>
          <input className={champ} type="date" value={date} max={aujourdhui()} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label className={etiquette}>Avancement du chantier : {pct} %</label>
          <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => setPct(e.target.value)} className="w-full accent-chantier" />
        </div>
        <div>
          <label className={etiquette}>Travaux réalisés aujourd'hui</label>
          <textarea className={champ} rows={4} value={travaux} onChange={(e) => setTravaux(e.target.value)} placeholder="Ex. Deux couches de peinture dans le salon, enduit dans le couloir" required />
        </div>
        <fieldset>
          <legend className={etiquette}>Présents ({presents.length})</legend>
          <div className="grid grid-cols-2 gap-1">
            {personnes.map((p) => (
              <label key={p.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <input type="checkbox" checked={presents.includes(p.id)} onChange={() => basculer(p.id)} />
                {p.nom}
              </label>
            ))}
          </div>
          {!personnes.length && <p className="text-sm text-gray-500">Aucun ouvrier ou chef actif dans l'équipe.</p>}
        </fieldset>
        <div>
          <label className={etiquette}>Incident ou remarque (facultatif)</label>
          <textarea className={champ} rows={3} value={incident} onChange={(e) => setIncident(e.target.value)} placeholder="Ex. Manque de peinture blanche, accès bloqué…" />
        </div>
        <p className="text-xs text-gray-500">Les photos se prennent depuis la fiche du chantier ; celles du jour s'affichent dans le rapport.</p>
        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
        <button className={btn} disabled={envoi}>{envoi ? 'Patientez…' : id ? 'Enregistrer' : 'Envoyer le rapport'}</button>
      </form>
    </div>
  )
}

function messageErreur(e: { code?: string; message: string }) {
  if (e.code === '23505') return 'Un rapport existe déjà pour ce chantier à cette date. Ouvrez-le depuis la liste et modifiez-le.'
  if (e.code === '42501') return "Vous n'avez pas le droit d'écrire un rapport pour ce chantier."
  return e.message
}
