import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import RendezVousDevis, { type DevisLimite } from '../components/RendezVousDevis'
import { ajouterJours, aujourdhui, dateFr, lundiDe } from '../lib/format'
import { creneauDe, joursAPourvoir, jourCourt, type Creneau } from '../lib/planning'
import { supabase } from '../lib/supabase'
import { btnSec, carte } from '../lib/ui'
import { peutGerer, LIBELLE_RDV, type AffectationDatee, type AffectationSt, type Chantier, type RendezVous } from '../types'

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const COULEURS = ['bg-yellow-200', 'bg-sky-200', 'bg-green-200', 'bg-pink-200', 'bg-purple-200', 'bg-orange-200', 'bg-teal-200', 'bg-rose-200']
const couleurDe = (id: string) => COULEURS[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % COULEURS.length]

type Ch = Pick<Chantier, 'id' | 'titre' | 'statut' | 'chef_id' | 'date_debut' | 'date_fin_prevue'>
interface Personne { id: string; nom: string }
interface Ligne { cle: string; nom: string; creneaux: { chantier: Ch; creneau: Creneau; mission?: string | null }[] }

const heureCourte = (h: string | null) => (h ? h.slice(0, 5) : '')

export default function Planning() {
  const { profil } = useAuth()
  const gere = peutGerer(profil?.role)
  const [semaine, setSemaine] = useState(lundiDe(aujourdhui()))
  const [chantiers, setChantiers] = useState<Ch[]>([])
  const [affs, setAffs] = useState<AffectationDatee[]>([])
  const [affsSt, setAffsSt] = useState<AffectationSt[]>([])
  const [personnes, setPersonnes] = useState<Personne[]>([])
  const [rdvs, setRdvs] = useState<RendezVous[]>([])
  const [devisLimites, setDevisLimites] = useState<DevisLimite[]>([])
  const [indicatif, setIndicatif] = useState<string | undefined>()
  const [pret, setPret] = useState(false)
  const [erreur, setErreur] = useState('')
  const auj = aujourdhui()

  const charger = useCallback(async () => {
    const [c, a, p, st, rv, dv, ent] = await Promise.all([
      supabase.from('chantiers').select('id, titre, statut, chef_id, date_debut, date_fin_prevue').in('statut', ['a_planifier', 'en_cours', 'en_pause']),
      supabase.from('affectations').select('*'),
      supabase.from('profils').select('id, nom').eq('actif', true).order('nom'),
      supabase.from('affectations_st').select('*, sous_traitants(nom, specialite)'),
      supabase.from('rendez_vous').select('*, clients(nom, telephone, adresse)').gte('date_rdv', ajouterJours(aujourdhui(), -30)),
      supabase.from('devis').select('id, numero, date_limite_envoi, clients(nom)').eq('statut', 'brouillon').not('date_limite_envoi', 'is', null),
      supabase.from('entreprise').select('indicatif_pays').eq('id', 1).maybeSingle(),
    ])
    if (c.error || a.error) setErreur((c.error ?? a.error)!.message)
    setChantiers((c.data ?? []) as Ch[])
    setAffs((a.data ?? []) as AffectationDatee[])
    setPersonnes((p.data ?? []) as Personne[])
    // Ces trois requêtes dépendent de la phase 8 : si elle n'est pas installée, on les ignore sans bloquer le planning.
    setAffsSt((st.error ? [] : st.data ?? []) as unknown as AffectationSt[])
    setRdvs((rv.error ? [] : rv.data ?? []) as unknown as RendezVous[])
    setDevisLimites((dv.error ? [] : dv.data ?? []) as unknown as DevisLimite[])
    setIndicatif((ent.data?.indicatif_pays as string | undefined) ?? undefined)
    setPret(true)
  }, [])

  useEffect(() => { void charger() }, [charger])

  const jours = useMemo(() => Array.from({ length: 7 }, (_, i) => ajouterJours(semaine, i)), [semaine])

  // Créneaux par employé et par sous-traitant : dates de l'affectation, sinon dates du chantier
  const { employes, soustraitants, sansDates } = useMemo(() => {
    const parPersonne = new Map<string, Ligne['creneaux']>()
    const parSt = new Map<string, Ligne['creneaux']>()
    const sans = new Set<string>()
    const ajouter = (m: Map<string, Ligne['creneaux']>, uid: string, ch: Ch, debut: string | null, fin: string | null, mission?: string | null) => {
      const creneau = creneauDe(ch, debut, fin)
      if (!creneau) { sans.add(ch.id); return }
      m.set(uid, [...(m.get(uid) ?? []), { chantier: ch, creneau, mission }])
    }
    for (const ch of chantiers) {
      const equipe = affs.filter((a) => a.chantier_id === ch.id)
      const externes = affsSt.filter((s) => s.chantier_id === ch.id)
      for (const a of equipe) ajouter(parPersonne, a.utilisateur_id, ch, a.date_debut, a.date_fin)
      if (ch.chef_id && !equipe.some((a) => a.utilisateur_id === ch.chef_id)) ajouter(parPersonne, ch.chef_id, ch, null, null)
      for (const s of externes) ajouter(parSt, s.sous_traitant_id, ch, s.date_debut, s.date_fin, s.mission)
      // Chantier sans personne et sans dates : il doit quand même apparaître quelque part
      if (!equipe.length && !externes.length && !ch.chef_id && (!ch.date_debut || !ch.date_fin_prevue)) sans.add(ch.id)
    }
    const visible = (l: Ligne['creneaux']) => l.some((c) => c.creneau.debut <= jours[6] && c.creneau.fin >= jours[0])
    const employes: Ligne[] = personnes
      .filter((p) => parPersonne.has(p.id))
      .map((p) => ({ cle: p.id, nom: p.nom, creneaux: parPersonne.get(p.id)! }))
      .filter((l) => visible(l.creneaux))
    const noms = new Map(affsSt.map((s) => [s.sous_traitant_id, s.sous_traitants?.nom ?? 'Sous-traitant']))
    const soustraitants: Ligne[] = [...parSt.entries()]
      .map(([id, creneaux]) => ({ cle: id, nom: noms.get(id) ?? 'Sous-traitant', creneaux }))
      .filter((l) => visible(l.creneaux))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    return { employes, soustraitants, sansDates: chantiers.filter((c) => sans.has(c.id)) }
  }, [chantiers, affs, affsSt, personnes, jours])

  // Chantiers à pourvoir : jours ouverts sans personne affectée
  const aPourvoirSemaine = useMemo(() => {
    const m = new Map<string, Ch[]>() // jour -> chantiers à pourvoir
    for (const ch of chantiers) {
      for (const j of joursAPourvoir(ch, jours[0], jours[6], affs, affsSt)) m.set(j, [...(m.get(j) ?? []), ch])
    }
    return m
  }, [chantiers, jours, affs, affsSt])

  const prochainsJours = useMemo(() => {
    const fin = ajouterJours(auj, 6)
    return chantiers
      .map((ch) => ({ ch, jours: joursAPourvoir(ch, auj, fin, affs, affsSt) }))
      .filter((x) => x.jours.length > 0)
      .sort((a, b) => a.jours[0].localeCompare(b.jours[0]))
  }, [chantiers, auj, affs, affsSt])

  const retards = chantiers
    .filter((c) => c.statut === 'en_cours' && c.date_fin_prevue && c.date_fin_prevue < auj)
    .map((c) => ({ c, jours: Math.round((Date.parse(auj) - Date.parse(c.date_fin_prevue!)) / 864e5) }))
    .sort((x, y) => y.jours - x.jours)

  const finSemaine = jours[6]
  const rdvsSemaine = rdvs.filter((r) => r.statut !== 'annule')
  const ligneDevis = jours.some((j) => rdvsSemaine.some((r) => r.date_rdv === j) || devisLimites.some((d) => d.date_limite_envoi === j))
  const ligneAPourvoir = aPourvoirSemaine.size > 0
  const rien = !employes.length && !soustraitants.length && !ligneAPourvoir && !ligneDevis

  const cellule = (j: string) => (j === auj ? 'bg-chantier/10' : '')
  const nomPersonne = (id: string | null) => personnes.find((p) => p.id === id)?.nom

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Planning</h1>

      {gere && prochainsJours.length > 0 && (
        <div className={`${carte} space-y-1 border border-orange-300 bg-orange-50`}>
          <p className="font-semibold text-orange-800">À pourvoir dans les 7 prochains jours ({prochainsJours.length})</p>
          <p className="text-xs text-gray-600">Chantiers ouverts sans personne d'affecté. Affectez un employé ou un sous-traitant depuis la fiche du chantier.</p>
          {prochainsJours.map(({ ch, jours: js }) => (
            <Link key={ch.id} to={`/chantiers/${ch.id}`} className="flex justify-between gap-2 text-sm">
              <span className="truncate">{ch.titre}</span>
              <b className="whitespace-nowrap text-orange-800">dès {jourCourt(js[0])} · {js.length} j</b>
            </Link>
          ))}
        </div>
      )}

      {retards.length > 0 && (
        <div className={`${carte} space-y-1 border border-red-200 bg-red-50`}>
          <p className="font-semibold text-red-700">Chantiers en retard ({retards.length})</p>
          {retards.map(({ c, jours: n }) => (
            <Link key={c.id} to={`/chantiers/${c.id}`} className="flex justify-between text-sm">
              <span>{c.titre}</span><b className="text-red-700">{n} j de retard</b>
            </Link>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <button className={btnSec} onClick={() => setSemaine(ajouterJours(semaine, -7))} aria-label="Semaine précédente">‹</button>
        <div className="text-center">
          <p className="font-semibold">{dateFr(semaine)} – {dateFr(finSemaine)}</p>
          {semaine !== lundiDe(auj) && <button className="text-sm underline" onClick={() => setSemaine(lundiDe(auj))}>Revenir à cette semaine</button>}
        </div>
        <button className={btnSec} onClick={() => setSemaine(ajouterJours(semaine, 7))} aria-label="Semaine suivante">›</button>
      </div>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {!pret && <p className="text-center text-gray-500">Chargement…</p>}

      {pret && (
        <div className={`${carte} overflow-x-auto !p-0`}>
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="sticky left-0 z-10 w-28 bg-white p-2 text-left">Équipe</th>
                {jours.map((j, i) => (
                  <th key={j} className={`p-2 text-center ${j === auj ? 'bg-chantier/30' : ''}`}>
                    {JOURS[i]}<br /><span className="text-xs font-normal text-gray-500">{j.slice(8)}/{j.slice(5, 7)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ligneAPourvoir && (
                <tr className="border-b border-orange-200 bg-orange-50/60 align-top">
                  <td className="sticky left-0 z-10 bg-orange-50 p-2 font-semibold text-orange-800">À pourvoir</td>
                  {jours.map((j) => (
                    <td key={j} className={`p-1 ${cellule(j)}`}>
                      {(aPourvoirSemaine.get(j) ?? []).map((ch) => (
                        <Link key={ch.id} to={`/chantiers/${ch.id}`} title={`${ch.titre} : personne d'affecté`}
                          className="mb-1 block truncate rounded border-2 border-dashed border-orange-400 bg-orange-100 px-1.5 py-1 text-xs font-semibold text-orange-900">
                          {ch.titre}
                        </Link>
                      ))}
                    </td>
                  ))}
                </tr>
              )}
              {ligneDevis && (
                <tr className="border-b border-sky-200 bg-sky-50/60 align-top">
                  <td className="sticky left-0 z-10 bg-sky-50 p-2 font-semibold text-sky-800">Devis</td>
                  {jours.map((j) => (
                    <td key={j} className={`p-1 ${cellule(j)}`}>
                      {rdvsSemaine.filter((r) => r.date_rdv === j).map((r) => (
                        <div key={r.id} title={`${LIBELLE_RDV[r.type]} · ${r.clients?.nom ?? ''}${nomPersonne(r.responsable_id) ? ' · ' + nomPersonne(r.responsable_id) : ''}`}
                          className={`mb-1 rounded bg-sky-200 px-1.5 py-1 text-xs font-semibold text-sky-900 ${r.statut === 'fait' ? 'line-through opacity-60' : ''}`}>
                          {r.heure ? heureCourte(r.heure) + ' ' : ''}{LIBELLE_RDV[r.type].split(' ')[0]} · {r.clients?.nom ?? 'Client'}
                        </div>
                      ))}
                      {devisLimites.filter((d) => d.date_limite_envoi === j).map((d) => (
                        <Link key={d.id} to={`/devis/${d.id}`} title={`À envoyer : ${d.numero}`}
                          className="mb-1 block truncate rounded border border-sky-400 bg-white px-1.5 py-1 text-xs font-semibold text-sky-900">
                          Envoyer {d.numero}
                        </Link>
                      ))}
                    </td>
                  ))}
                </tr>
              )}
              {employes.map(({ cle, nom, creneaux }) => (
                <tr key={cle} className="border-b border-gray-100 align-top">
                  <td className="sticky left-0 z-10 bg-white p-2 font-semibold">{nom}</td>
                  {jours.map((j) => (
                    <td key={j} className={`p-1 ${cellule(j)}`}>
                      {creneaux.filter((c) => c.creneau.debut <= j && c.creneau.fin >= j).map((c) => (
                        <Link key={c.chantier.id} to={`/chantiers/${c.chantier.id}`}
                          className={`mb-1 block truncate rounded px-1.5 py-1 text-xs font-semibold ${couleurDe(c.chantier.id)} ${c.chantier.statut === 'en_pause' ? 'opacity-50' : ''}`}
                          title={c.chantier.titre}>
                          {c.chantier.titre}
                        </Link>
                      ))}
                    </td>
                  ))}
                </tr>
              ))}
              {soustraitants.length > 0 && (
                <tr className="bg-gray-50"><td colSpan={8} className="sticky left-0 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Sous-traitants</td></tr>
              )}
              {soustraitants.map(({ cle, nom, creneaux }) => (
                <tr key={cle} className="border-b border-gray-100 align-top">
                  <td className="sticky left-0 z-10 bg-white p-2 font-semibold">{nom}</td>
                  {jours.map((j) => (
                    <td key={j} className={`p-1 ${cellule(j)}`}>
                      {creneaux.filter((c) => c.creneau.debut <= j && c.creneau.fin >= j).map((c, i) => (
                        <Link key={c.chantier.id + i} to={`/chantiers/${c.chantier.id}`}
                          className={`mb-1 block truncate rounded border-2 border-dashed border-gray-400 px-1.5 py-1 text-xs font-semibold ${couleurDe(c.chantier.id)} ${c.chantier.statut === 'en_pause' ? 'opacity-50' : ''}`}
                          title={`${c.chantier.titre}${c.mission ? ' · ' + c.mission : ''}`}>
                          {c.chantier.titre}
                        </Link>
                      ))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rien && <p className="p-4 text-center text-gray-500">Rien de planifié cette semaine.</p>}
        </div>
      )}

      <RendezVousDevis
        rdvs={rdvs}
        devisAEnvoyer={devisLimites}
        profils={personnes}
        gere={gere}
        indicatif={indicatif}
        onChange={() => void charger()}
      />

      {pret && sansDates.length > 0 && (
        <div className={`${carte} space-y-1`}>
          <p className="font-semibold">Non planifiés : dates manquantes ({sansDates.length})</p>
          <p className="text-xs text-gray-500">Renseignez les dates du chantier ou de l'affectation pour les voir dans la grille.</p>
          {sansDates.map((c) => <Link key={c.id} to={`/chantiers/${c.id}`} className="block text-sm underline">{c.titre}</Link>)}
        </div>
      )}
    </div>
  )
}
