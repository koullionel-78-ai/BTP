import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { aujourdhui, dateFr, fcfa } from '../lib/format'
import { nombre } from '../lib/stock'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte, champ, etiquette } from '../lib/ui'
import { LIBELLE_ETAT_MATERIEL, peutGerer, type EtatMateriel, type Materiel } from '../types'

interface Hist { id: string; chantier_id: string | null; detenteur_id: string | null; created_at: string }
interface Maint { id: string; date_maintenance: string; description: string; cout: number }

const COULEUR_ETAT: Record<EtatMateriel, string> = {
  bon: 'bg-green-100 text-green-700', a_reparer: 'bg-orange-100 text-orange-700', hors_service: 'bg-red-100 text-red-700',
}

export default function MaterielPage() {
  const { profil } = useAuth()
  const gere = peutGerer(profil?.role)
  const [liste, setListe] = useState<Materiel[]>([])
  const [chantiers, setChantiers] = useState<{ id: string; titre: string }[]>([])
  const [personnes, setPersonnes] = useState<{ id: string; nom: string }[]>([])
  const [q, setQ] = useState('')
  const [filtreEtat, setFiltreEtat] = useState('')
  const [nouveau, setNouveau] = useState(false)
  const [nom, setNom] = useState(''); const [reference, setReference] = useState('')
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [hist, setHist] = useState<Hist[]>([])
  const [maints, setMaints] = useState<Maint[]>([])
  const [eEtat, setEEtat] = useState<EtatMateriel>('bon'); const [eChantier, setEChantier] = useState(''); const [eDetenteur, setEDetenteur] = useState(''); const [eProchaine, setEProchaine] = useState('')
  const [mDesc, setMDesc] = useState(''); const [mCout, setMCout] = useState('0'); const [mDate, setMDate] = useState(aujourdhui()); const [mProchaine, setMProchaine] = useState('')
  const [msg, setMsg] = useState('')

  async function charger() {
    const [m, c, p] = await Promise.all([
      supabase.from('materiel').select('*').eq('actif', true).order('nom'),
      supabase.from('chantiers').select('id, titre').order('titre'),
      supabase.from('profils').select('id, nom').eq('actif', true).order('nom'),
    ])
    if (m.error) setMsg(m.error.message)
    setListe((m.data ?? []) as Materiel[])
    setChantiers((c.data ?? []) as { id: string; titre: string }[])
    setPersonnes((p.data ?? []) as { id: string; nom: string }[])
  }
  useEffect(() => { void charger() }, [])

  if (!profil || profil.role === 'ouvrier') return <p className={carte}>Accès non autorisé.</p>

  const chantierDe = (id: string | null) => chantiers.find((c) => c.id === id)?.titre
  const personneDe = (id: string | null) => personnes.find((p) => p.id === id)?.nom

  async function ouvrir(m: Materiel) {
    if (ouvert === m.id) return setOuvert(null)
    setOuvert(m.id)
    setEEtat(m.etat); setEChantier(m.chantier_id ?? ''); setEDetenteur(m.detenteur_id ?? ''); setEProchaine(m.prochaine_maintenance ?? '')
    setMDesc(''); setMCout('0'); setMProchaine('')
    const [h, mt] = await Promise.all([
      supabase.from('materiel_historique').select('*').eq('materiel_id', m.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('maintenances_materiel').select('*').eq('materiel_id', m.id).order('date_maintenance', { ascending: false }).limit(10),
    ])
    setHist((h.data ?? []) as Hist[])
    setMaints((mt.data ?? []) as Maint[])
  }

  async function ajouter(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('materiel').insert({ nom: nom.trim(), reference: reference.trim() || null })
    if (error) return setMsg(error.message)
    setNom(''); setReference(''); setNouveau(false); setMsg('')
    await charger()
  }

  async function enregistrer(m: Materiel) {
    const { error } = await supabase.from('materiel').update({
      etat: eEtat, chantier_id: eChantier || null, detenteur_id: eDetenteur || null, prochaine_maintenance: eProchaine || null,
    }).eq('id', m.id)
    if (error) return setMsg(error.message)
    setMsg('')
    await charger()
    setOuvert(null)
  }

  async function ajouterMaintenance(e: FormEvent, m: Materiel) {
    e.preventDefault()
    const c = nombre(mCout)
    if (Number.isNaN(c) || c < 0 || !Number.isInteger(c)) return setMsg('Le coût doit être un entier positif ou nul.')
    const { error } = await supabase.from('maintenances_materiel').insert({ materiel_id: m.id, date_maintenance: mDate, description: mDesc.trim(), cout: c })
    if (error) return setMsg(error.message)
    if (mProchaine) {
      const r = await supabase.from('materiel').update({ prochaine_maintenance: mProchaine }).eq('id', m.id)
      if (r.error) return setMsg(r.error.message)
    }
    setMsg('')
    await charger()
    setOuvert(null)
  }

  async function retirer(m: Materiel) {
    if (!confirm(`Retirer « ${m.nom} » de la liste ? L'historique est conservé.`)) return
    const { error } = await supabase.from('materiel').update({ actif: false }).eq('id', m.id)
    setMsg(error ? error.message : '')
    await charger()
  }

  const terme = q.toLowerCase()
  const affiches = liste.filter((m) => (m.nom + ' ' + (m.reference ?? '')).toLowerCase().includes(terme) && (!filtreEtat || m.etat === filtreEtat))
  const auj = aujourdhui()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Matériel et outillage ({liste.length})</h1>
        {gere && <button className={nouveau ? btnSec : btn} onClick={() => setNouveau(!nouveau)}>{nouveau ? 'Annuler' : 'Nouveau'}</button>}
      </div>
      {nouveau && (
        <form onSubmit={ajouter} className={`${carte} space-y-3`}>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={etiquette}>Nom</label><input className={champ} value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Perceuse Bosch" required /></div>
            <div><label className={etiquette}>Référence</label><input className={champ} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="facultatif" /></div>
          </div>
          <button className={btn}>Ajouter</button>
        </form>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input className={champ} placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={champ} value={filtreEtat} onChange={(e) => setFiltreEtat(e.target.value)} aria-label="État">
          <option value="">Tous les états</option>
          {Object.entries(LIBELLE_ETAT_MATERIEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      {affiches.map((m) => {
        const echue = m.prochaine_maintenance !== null && m.prochaine_maintenance <= auj
        return (
          <div key={m.id} className={`${carte} space-y-2`}>
            <button className="flex w-full items-start justify-between gap-2 text-left" onClick={() => void ouvrir(m)}>
              <div>
                <p className="font-semibold">{m.nom}{m.reference && <span className="font-normal text-gray-500"> · {m.reference}</span>}</p>
                <p className="text-sm text-gray-500">
                  {chantierDe(m.chantier_id) ? `Sur ${chantierDe(m.chantier_id)}` : 'Au dépôt'}{personneDe(m.detenteur_id) && ` · ${personneDe(m.detenteur_id)}`}
                </p>
                {m.prochaine_maintenance && (
                  <p className={`text-sm ${echue ? 'font-semibold text-red-600' : 'text-gray-500'}`}>{echue ? 'Maintenance à faire depuis le ' : 'Prochaine maintenance le '}{dateFr(m.prochaine_maintenance)}</p>
                )}
              </div>
              <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${COULEUR_ETAT[m.etat]}`}>{LIBELLE_ETAT_MATERIEL[m.etat]}</span>
            </button>
            {ouvert === m.id && (
              <div className="space-y-3 border-t border-gray-100 pt-3">
                {gere && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={etiquette}>État</label>
                        <select className={champ} value={eEtat} onChange={(e) => setEEtat(e.target.value as EtatMateriel)}>
                          {Object.entries(LIBELLE_ETAT_MATERIEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                      </div>
                      <div><label className={etiquette}>Prochaine maintenance</label><input className={champ} type="date" value={eProchaine} onChange={(e) => setEProchaine(e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={etiquette}>Chantier</label>
                        <select className={champ} value={eChantier} onChange={(e) => setEChantier(e.target.value)}>
                          <option value="">Au dépôt</option>
                          {chantiers.map((c) => <option key={c.id} value={c.id}>{c.titre}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={etiquette}>Confié à</label>
                        <select className={champ} value={eDetenteur} onChange={(e) => setEDetenteur(e.target.value)}>
                          <option value="">Personne</option>
                          {personnes.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-3"><button className={btn} onClick={() => void enregistrer(m)}>Enregistrer</button><button className="text-sm text-red-600" onClick={() => void retirer(m)}>Retirer de la liste</button></div>
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold">Déplacements</p>
                  {hist.map((h) => <p key={h.id} className="text-sm text-gray-600">{dateFr(h.created_at)} · {chantierDe(h.chantier_id) ?? 'Dépôt'}{personneDe(h.detenteur_id) && ` · ${personneDe(h.detenteur_id)}`}</p>)}
                  {!hist.length && <p className="text-sm text-gray-500">Aucun déplacement enregistré.</p>}
                </div>
                <div>
                  <p className="text-sm font-semibold">Maintenances</p>
                  {maints.map((x) => <p key={x.id} className="text-sm text-gray-600">{dateFr(x.date_maintenance)} · {x.description}{x.cout > 0 && ` · ${fcfa(x.cout)}`}</p>)}
                  {!maints.length && <p className="text-sm text-gray-500">Aucune maintenance enregistrée.</p>}
                </div>
                {gere && (
                  <form onSubmit={(e) => void ajouterMaintenance(e, m)} className="space-y-2 rounded-lg bg-gray-50 p-3">
                    <p className="text-sm font-semibold">Enregistrer une maintenance</p>
                    <input className={champ} value={mDesc} onChange={(e) => setMDesc(e.target.value)} placeholder="Ex. Changement des charbons" required />
                    <div className="grid grid-cols-3 gap-2">
                      <div><label className={etiquette}>Date</label><input className={champ} type="date" value={mDate} max={auj} onChange={(e) => setMDate(e.target.value)} required /></div>
                      <div><label className={etiquette}>Coût</label><input className={champ} inputMode="numeric" value={mCout} onChange={(e) => setMCout(e.target.value)} /></div>
                      <div><label className={etiquette}>Prochaine</label><input className={champ} type="date" value={mProchaine} onChange={(e) => setMProchaine(e.target.value)} /></div>
                    </div>
                    <button className={btnSec}>Ajouter la maintenance</button>
                  </form>
                )}
              </div>
            )}
          </div>
        )
      })}
      {!affiches.length && <p className="text-center text-gray-500">Aucun matériel.</p>}
    </div>
  )
}
