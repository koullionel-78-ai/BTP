import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { fcfa } from '../lib/format'
import { qte } from '../lib/stock'
import { supabase } from '../lib/supabase'
import { carte } from '../lib/ui'
import { LIBELLE_STATUT, LIBELLE_TRAVAUX, peutGerer, type Rentabilite as R, type TypeTravaux } from '../types'

type Filtre = 'tous' | 'termine' | 'en_cours'
const pct = (marge: number, facture: number) => (facture > 0 ? Math.round((marge / facture) * 100) : null)
const signe = (n: number) => (n < 0 ? '− ' : '') + fcfa(Math.abs(n))

export default function Rentabilite() {
  const { profil } = useAuth()
  const [lignes, setLignes] = useState<R[]>([])
  const [filtre, setFiltre] = useState<Filtre>('tous')
  const [erreur, setErreur] = useState('')
  const [pret, setPret] = useState(false)

  useEffect(() => {
    if (!peutGerer(profil?.role)) return
    supabase.from('chantier_rentabilite').select('*').then(({ data, error }) => {
      if (error) setErreur(error.message)
      setLignes((data ?? []) as R[])
      setPret(true)
    })
  }, [profil?.role])

  const retenues = useMemo(
    () => lignes
      .filter((c) => (c.facture > 0 || c.depenses > 0) && (filtre === 'tous' || c.statut === filtre))
      .sort((a, b) => b.facture - b.depenses - (a.facture - a.depenses)),
    [lignes, filtre],
  )

  const parType = useMemo(() => {
    const m = new Map<TypeTravaux, { nb: number; facture: number; depenses: number; jours: number }>()
    for (const c of retenues.filter((x) => x.facture > 0)) {
      const cur = m.get(c.type_travaux) ?? { nb: 0, facture: 0, depenses: 0, jours: 0 }
      cur.nb += 1
      cur.facture += c.facture
      cur.depenses += c.depenses
      cur.jours += c.jours_homme
      m.set(c.type_travaux, cur)
    }
    return [...m.entries()].sort((a, b) => b[1].facture - b[1].depenses - (a[1].facture - a[1].depenses))
  }, [retenues])

  if (!peutGerer(profil?.role)) return <p className={carte}>Accès non autorisé.</p>

  return (
    <div className="space-y-3">
      <Link to="/finances" className="text-sm underline">← Finances</Link>
      <h1 className="text-xl font-bold">Rentabilité</h1>
      <div className="flex gap-2">
        {([['tous', 'Tous'], ['termine', 'Terminés'], ['en_cours', 'En cours']] as [Filtre, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setFiltre(k)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${filtre === k ? 'bg-nuit text-white' : 'bg-white'}`}>{l}</button>
        ))}
      </div>
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {!pret && !erreur && <p className="text-center text-gray-500">Chargement…</p>}

      {pret && parType.length > 0 && (
        <div className={`${carte} space-y-2`}>
          <h2 className="font-bold">Par type de travaux</h2>
          {parType.map(([t, v]) => {
            const marge = v.facture - v.depenses
            const p = pct(marge, v.facture)
            return (
              <div key={t} className="flex items-start justify-between gap-2 border-t border-gray-100 pt-2 text-sm">
                <div>
                  <p className="font-semibold">{LIBELLE_TRAVAUX[t]}</p>
                  <p className="text-gray-500">{v.nb} chantier{v.nb > 1 ? 's' : ''} · facturé {fcfa(v.facture)}</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${marge < 0 ? 'text-red-600' : 'text-green-700'}`}>{signe(marge)}{p !== null && ` (${p} %)`}</p>
                  {v.jours > 0 && <p className="text-gray-500">{signe(Math.round(marge / v.jours))} / jour-homme</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {retenues.map((c) => {
        const marge = c.facture - c.depenses
        const p = pct(marge, c.facture)
        return (
          <Link key={c.chantier_id} to={`/chantiers/${c.chantier_id}`} className={`${carte} block space-y-2`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{c.titre}</p>
                <p className="text-sm text-gray-500">{LIBELLE_TRAVAUX[c.type_travaux]} · {LIBELLE_STATUT[c.statut]}</p>
              </div>
              {c.facture > 0 ? (
                <p className={`text-right font-bold ${marge < 0 ? 'text-red-600' : 'text-green-700'}`}>{signe(marge)}{p !== null && <span className="block text-sm">{p} % du facturé</span>}</p>
              ) : <span className="text-xs text-gray-500">Rien de facturé</span>}
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Facturé</dt><dd>{fcfa(c.facture)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Matériaux</dt><dd>{fcfa(c.dep_materiaux)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Main-d'œuvre</dt><dd>{fcfa(c.dep_main_oeuvre)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Sous-traitance</dt><dd>{fcfa(c.dep_sous_traitance)}</dd></div>
              {c.dep_autres > 0 && <div className="flex justify-between"><dt className="text-gray-500">Autres</dt><dd>{fcfa(c.dep_autres)}</dd></div>}
              <div className="flex justify-between"><dt className="text-gray-500">Jours-homme</dt><dd>{qte(c.jours_homme)}</dd></div>
            </dl>
            {c.facture > 0 && c.jours_homme > 0 && <p className="text-sm text-gray-500">Marge par jour-homme : {signe(Math.round(marge / c.jours_homme))}</p>}
          </Link>
        )
      })}
      {pret && !retenues.length && <p className="text-center text-gray-500">Aucun chantier avec des factures ou des dépenses.</p>}
      <p className="text-xs text-gray-500">
        Marge = facturé − dépenses saisies. Les jours-homme sont les présences cochées dans les rapports journaliers. Si la main-d'œuvre ou la sous-traitance n'est pas saisie en dépense, la marge est surestimée.
      </p>
    </div>
  )
}
