import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ajouterJours, aujourdhui, dateFr, lundiDe } from '../lib/format'
import { supabase } from '../lib/supabase'
import { btnSec, carte } from '../lib/ui'
import type { AffectationDatee, Chantier } from '../types'

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const COULEURS = ['bg-yellow-200', 'bg-sky-200', 'bg-green-200', 'bg-pink-200', 'bg-purple-200', 'bg-orange-200', 'bg-teal-200', 'bg-rose-200']
const couleurDe = (id: string) => COULEURS[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % COULEURS.length]

type Ch = Pick<Chantier, 'id' | 'titre' | 'statut' | 'chef_id' | 'date_debut' | 'date_fin_prevue'>
interface Personne { id: string; nom: string }
interface Creneau { chantier: Ch; debut: string; fin: string }

export default function Planning() {
  const [semaine, setSemaine] = useState(lundiDe(aujourdhui()))
  const [chantiers, setChantiers] = useState<Ch[]>([])
  const [affs, setAffs] = useState<AffectationDatee[]>([])
  const [personnes, setPersonnes] = useState<Personne[]>([])
  const [pret, setPret] = useState(false)
  const [erreur, setErreur] = useState('')
  const auj = aujourdhui()

  useEffect(() => {
    void (async () => {
      const [c, a, p] = await Promise.all([
        supabase.from('chantiers').select('id, titre, statut, chef_id, date_debut, date_fin_prevue').in('statut', ['a_planifier', 'en_cours', 'en_pause']),
        supabase.from('affectations').select('*'),
        supabase.from('profils').select('id, nom').eq('actif', true).order('nom'),
      ])
      if (c.error || a.error) setErreur((c.error ?? a.error)!.message)
      setChantiers((c.data ?? []) as Ch[])
      setAffs((a.data ?? []) as AffectationDatee[])
      setPersonnes((p.data ?? []) as Personne[])
      setPret(true)
    })()
  }, [])

  const jours = useMemo(() => Array.from({ length: 7 }, (_, i) => ajouterJours(semaine, i)), [semaine])

  // Créneaux par personne : dates de l'affectation, sinon dates du chantier
  const { lignes, sansDates } = useMemo(() => {
    const parPersonne = new Map<string, Creneau[]>()
    const sans = new Set<string>()
    const ajouter = (uid: string, ch: Ch, debut: string | null, fin: string | null) => {
      const d = debut ?? ch.date_debut
      const f = fin ?? ch.date_fin_prevue
      if (!d || !f) { sans.add(ch.id); return }
      parPersonne.set(uid, [...(parPersonne.get(uid) ?? []), { chantier: ch, debut: d, fin: f }])
    }
    for (const ch of chantiers) {
      const equipe = affs.filter((a) => a.chantier_id === ch.id)
      for (const a of equipe) ajouter(a.utilisateur_id, ch, a.date_debut, a.date_fin)
      if (ch.chef_id && !equipe.some((a) => a.utilisateur_id === ch.chef_id)) ajouter(ch.chef_id, ch, null, null)
    }
    const lignes = personnes
      .filter((p) => parPersonne.has(p.id))
      .map((p) => ({ personne: p, creneaux: parPersonne.get(p.id)! }))
      .filter((l) => l.creneaux.some((c) => c.debut <= jours[6] && c.fin >= jours[0]))
    return { lignes, sansDates: chantiers.filter((c) => sans.has(c.id)) }
  }, [chantiers, affs, personnes, jours])

  const retards = chantiers
    .filter((c) => c.statut === 'en_cours' && c.date_fin_prevue && c.date_fin_prevue < auj)
    .map((c) => ({ c, jours: Math.round((Date.parse(auj) - Date.parse(c.date_fin_prevue!)) / 864e5) }))
    .sort((x, y) => y.jours - x.jours)

  const finSemaine = jours[6]

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Planning</h1>

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
              {lignes.map(({ personne, creneaux }) => (
                <tr key={personne.id} className="border-b border-gray-100 align-top">
                  <td className="sticky left-0 z-10 bg-white p-2 font-semibold">{personne.nom}</td>
                  {jours.map((j) => {
                    const du = creneaux.filter((c) => c.debut <= j && c.fin >= j)
                    return (
                      <td key={j} className={`p-1 ${j === auj ? 'bg-chantier/10' : ''}`}>
                        {du.map((c) => (
                          <Link key={c.chantier.id} to={`/chantiers/${c.chantier.id}`}
                            className={`mb-1 block truncate rounded px-1.5 py-1 text-xs font-semibold ${couleurDe(c.chantier.id)} ${c.chantier.statut === 'en_pause' ? 'opacity-50' : ''}`}
                            title={c.chantier.titre}>
                            {c.chantier.titre}
                          </Link>
                        ))}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {!lignes.length && <p className="p-4 text-center text-gray-500">Personne n'est planifié cette semaine.</p>}
        </div>
      )}

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
