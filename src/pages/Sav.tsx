import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { aujourdhui, dateFr } from '../lib/format'
import { nombre } from '../lib/stock'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte, champ, etiquette } from '../lib/ui'
import { LIBELLE_SAV, peutGerer, type GarantieSuivi, type SavDemande, type StatutSav } from '../types'

type Onglet = 'garanties' | 'demandes'
type FiltreGarantie = 'actives' | 'bientot' | 'expirees'
const ALERTE_JOURS = 60

export default function Sav() {
  const { profil, session } = useAuth()
  const gere = peutGerer(profil?.role)
  const [onglet, setOnglet] = useState<Onglet>('demandes')
  const [garanties, setGaranties] = useState<GarantieSuivi[]>([])
  const [demandes, setDemandes] = useState<SavDemande[]>([])
  const [chantiers, setChantiers] = useState<{ id: string; titre: string; chef_id: string | null }[]>([])
  const [filtreG, setFiltreG] = useState<FiltreGarantie>('actives')
  const [filtreD, setFiltreD] = useState<StatutSav | 'ouvertes' | 'toutes'>('ouvertes')
  const [ouvert, setOuvert] = useState(false)
  const [msg, setMsg] = useState('')
  // formulaire garantie
  const [gChantier, setGChantier] = useState('')
  const [gDesignation, setGDesignation] = useState('Garantie des travaux')
  const [gMois, setGMois] = useState('12')
  const [gDebut, setGDebut] = useState(aujourdhui())
  // formulaire demande
  const [dChantier, setDChantier] = useState('')
  const [dDescription, setDDescription] = useState('')
  const [dGarantie, setDGarantie] = useState('')

  async function charger() {
    const [g, d, c] = await Promise.all([
      supabase.from('garanties_suivi').select('*').order('date_fin'),
      supabase.from('sav_demandes').select('*, chantiers(titre)').order('date_demande', { ascending: false }).limit(200),
      supabase.from('chantiers').select('id, titre, chef_id').order('titre'),
    ])
    const err = g.error ?? d.error
    if (err) setMsg(err.message)
    setGaranties((g.data ?? []) as GarantieSuivi[])
    setDemandes((d.data ?? []) as SavDemande[])
    setChantiers((c.data ?? []) as { id: string; titre: string; chef_id: string | null }[])
  }
  useEffect(() => { void charger() }, [])

  if (!profil || profil.role === 'ouvrier') return <p className={carte}>Accès non autorisé.</p>

  const chantiersSav = gere ? chantiers : chantiers.filter((c) => c.chef_id === session?.user.id)
  const actives = garanties.filter((g) => g.jours_restants >= 0)
  const garantiesAffichees = garanties.filter((g) =>
    filtreG === 'actives' ? g.jours_restants >= 0 : filtreG === 'bientot' ? g.jours_restants >= 0 && g.jours_restants <= ALERTE_JOURS : g.jours_restants < 0)
  const garantiesDuChantier = actives.filter((g) => g.chantier_id === dChantier)
  const ouvertes = demandes.filter((d) => d.statut === 'ouverte' || d.statut === 'en_cours').length
  const demandesAffichees = demandes.filter((d) =>
    filtreD === 'toutes' ? true : filtreD === 'ouvertes' ? d.statut === 'ouverte' || d.statut === 'en_cours' : d.statut === filtreD)

  async function creerGarantie(e: FormEvent) {
    e.preventDefault()
    const m = nombre(gMois)
    if (!gChantier) return setMsg('Choisissez un chantier.')
    if (Number.isNaN(m) || !Number.isInteger(m) || m < 1 || m > 240) return setMsg('La durée doit être un nombre entier de mois (1 à 240).')
    const { error } = await supabase.from('garanties').insert({ chantier_id: gChantier, designation: gDesignation.trim(), duree_mois: m, date_debut: gDebut })
    if (error) return setMsg(error.message)
    setMsg('')
    setOuvert(false)
    await charger()
  }

  async function supprimerGarantie(g: GarantieSuivi) {
    if (!confirm(`Supprimer « ${g.designation} » (${g.chantier_titre}) ?`)) return
    const { error } = await supabase.from('garanties').delete().eq('id', g.id)
    setMsg(error ? error.message : '')
    await charger()
  }

  async function creerDemande(e: FormEvent) {
    e.preventDefault()
    if (!dChantier) return setMsg('Choisissez un chantier.')
    const { error } = await supabase.from('sav_demandes').insert({
      chantier_id: dChantier, description: dDescription.trim(), garantie_id: dGarantie || null, sous_garantie: !!dGarantie,
    })
    if (error) return setMsg(error.message)
    setMsg('')
    setDDescription('')
    setOuvert(false)
    await charger()
  }

  async function majDemande(d: SavDemande, champs: Partial<SavDemande>) {
    const { error } = await supabase.from('sav_demandes').update(champs).eq('id', d.id)
    setMsg(error ? error.message : '')
    await charger()
  }

  function changerStatut(d: SavDemande, statut: StatutSav) {
    const clos = statut === 'resolue' || statut === 'refusee'
    void majDemande(d, { statut, date_resolution: clos ? aujourdhui() : null })
  }

  function choisirChantierDemande(cid: string) {
    setDChantier(cid)
    setDGarantie(actives.find((g) => g.chantier_id === cid)?.id ?? '')
  }

  const formulaireOuvert = ouvert && (onglet === 'garanties' ? gere : true)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Garanties et SAV</h1>
        {(onglet === 'demandes' || gere) && (
          <button className={ouvert ? btnSec : btn} onClick={() => setOuvert(!ouvert)}>
            {ouvert ? 'Fermer' : onglet === 'garanties' ? 'Nouvelle garantie' : 'Nouvelle demande'}
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {([['demandes', `Demandes (${ouvertes} ouverte${ouvertes > 1 ? 's' : ''})`], ['garanties', `Garanties (${actives.length})`]] as [Onglet, string][]).map(([k, l]) => (
          <button key={k} onClick={() => { setOnglet(k); setOuvert(false) }} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${onglet === k ? 'bg-nuit text-white' : 'bg-white'}`}>{l}</button>
        ))}
      </div>
      {msg && <p className="text-sm text-red-600">{msg}</p>}

      {onglet === 'garanties' && (
        <>
          {formulaireOuvert && (
            <form onSubmit={creerGarantie} className={`${carte} space-y-3`}>
              <div>
                <label className={etiquette}>Chantier</label>
                <select className={champ} value={gChantier} onChange={(e) => setGChantier(e.target.value)} required>
                  <option value="">Choisir…</option>
                  {chantiers.map((c) => <option key={c.id} value={c.id}>{c.titre}</option>)}
                </select>
              </div>
              <div><label className={etiquette}>Désignation</label><input className={champ} value={gDesignation} onChange={(e) => setGDesignation(e.target.value)} required /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={etiquette}>Durée (mois)</label><input className={champ} inputMode="numeric" value={gMois} onChange={(e) => setGMois(e.target.value)} required /></div>
                <div><label className={etiquette}>Début</label><input className={champ} type="date" value={gDebut} onChange={(e) => setGDebut(e.target.value)} required /></div>
              </div>
              <button className={btn}>Créer la garantie</button>
            </form>
          )}
          <div className="flex gap-2 overflow-x-auto">
            {([['actives', 'En cours'], ['bientot', `Bientôt expirées (≤ ${ALERTE_JOURS} j)`], ['expirees', 'Expirées']] as [FiltreGarantie, string][]).map(([k, l]) => (
              <button key={k} onClick={() => setFiltreG(k)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${filtreG === k ? 'bg-nuit text-white' : 'bg-white'}`}>{l}</button>
            ))}
          </div>
          {garantiesAffichees.map((g) => {
            const bientot = g.jours_restants >= 0 && g.jours_restants <= ALERTE_JOURS
            return (
              <div key={g.id} className={`${carte} space-y-1`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link to={`/chantiers/${g.chantier_id}`} className="font-semibold underline">{g.chantier_titre}</Link>
                    <p className="text-sm text-gray-500">{g.designation} · {g.duree_mois} mois</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${g.jours_restants < 0 ? 'bg-gray-200 text-gray-600' : bientot ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-700'}`}>
                    {g.jours_restants < 0 ? 'Expirée' : g.jours_restants === 0 ? 'Expire aujourd\'hui' : `${g.jours_restants} j restants`}
                  </span>
                </div>
                <p className="text-sm">Du {dateFr(g.date_debut)} au {dateFr(g.date_fin)}</p>
                {gere && <button className="text-sm text-red-600" onClick={() => void supprimerGarantie(g)}>Supprimer</button>}
              </div>
            )
          })}
          {!garantiesAffichees.length && <p className="text-center text-gray-500">Aucune garantie dans ce filtre.</p>}
        </>
      )}

      {onglet === 'demandes' && (
        <>
          {formulaireOuvert && (
            <form onSubmit={creerDemande} className={`${carte} space-y-3`}>
              <div>
                <label className={etiquette}>Chantier</label>
                <select className={champ} value={dChantier} onChange={(e) => choisirChantierDemande(e.target.value)} required>
                  <option value="">Choisir…</option>
                  {chantiersSav.map((c) => <option key={c.id} value={c.id}>{c.titre}</option>)}
                </select>
              </div>
              {dChantier && (
                <div>
                  <label className={etiquette}>Garantie</label>
                  <select className={champ} value={dGarantie} onChange={(e) => setDGarantie(e.target.value)}>
                    <option value="">Hors garantie</option>
                    {garantiesDuChantier.map((g) => <option key={g.id} value={g.id}>{g.designation} (jusqu'au {dateFr(g.date_fin)})</option>)}
                  </select>
                </div>
              )}
              <div><label className={etiquette}>Problème signalé</label><textarea className={champ} rows={3} value={dDescription} onChange={(e) => setDDescription(e.target.value)} placeholder="Ex. Fissure au plafond de la chambre, cloques sur le mur nord" required /></div>
              <button className={btn}>Enregistrer la demande</button>
            </form>
          )}
          <div className="flex gap-2 overflow-x-auto">
            {([['ouvertes', 'Ouvertes'], ['resolue', 'Résolues'], ['refusee', 'Refusées'], ['toutes', 'Toutes']] as [typeof filtreD, string][]).map(([k, l]) => (
              <button key={k} onClick={() => setFiltreD(k)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${filtreD === k ? 'bg-nuit text-white' : 'bg-white'}`}>{l}</button>
            ))}
          </div>
          {demandesAffichees.map((d) => (
            <div key={d.id} className={`${carte} space-y-2`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link to={`/chantiers/${d.chantier_id}`} className="font-semibold underline">{d.chantiers?.titre ?? 'Chantier'}</Link>
                  <p className="text-sm text-gray-500">{dateFr(d.date_demande)} · {d.sous_garantie ? 'Sous garantie' : 'Hors garantie'}</p>
                </div>
                <select className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm" value={d.statut} onChange={(e) => changerStatut(d, e.target.value as StatutSav)} aria-label="Statut">
                  {Object.entries(LIBELLE_SAV).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <p className="whitespace-pre-line text-sm">{d.description}</p>
              <textarea
                className={`${champ} text-sm`}
                rows={2}
                placeholder="Intervention réalisée / réponse au client"
                defaultValue={d.resolution ?? ''}
                onBlur={(e) => { if ((e.target.value.trim() || null) !== d.resolution) void majDemande(d, { resolution: e.target.value.trim() || null }) }}
              />
              {d.date_resolution && <p className="text-xs text-gray-500">Clôturée le {dateFr(d.date_resolution)}</p>}
            </div>
          ))}
          {!demandesAffichees.length && <p className="text-center text-gray-500">Aucune demande dans ce filtre.</p>}
        </>
      )}
    </div>
  )
}
