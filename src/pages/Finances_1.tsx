import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { aujourdhui, fcfa } from '../lib/format'
import { supabase } from '../lib/supabase'
import { btnSec, carte } from '../lib/ui'
import { LIBELLE_DEPENSE, LIBELLE_STATUT, peutGerer, type CategorieDepense, type ChantierFinance } from '../types'

type Periode = 'mois' | 'annee' | 'tout'
const LIBELLE_PERIODE: Record<Periode, string> = { mois: 'Ce mois', annee: 'Cette année', tout: 'Tout' }

function debutPeriode(p: Periode): string | null {
  const auj = aujourdhui()
  if (p === 'mois') return auj.slice(0, 8) + '01'
  if (p === 'annee') return auj.slice(0, 5) + '01-01'
  return null
}

export default function Finances() {
  const { profil } = useAuth()
  const [periode, setPeriode] = useState<Periode>('mois')
  const [facture, setFacture] = useState(0)
  const [encaisse, setEncaisse] = useState(0)
  const [depenses, setDepenses] = useState(0)
  const [parCategorie, setParCategorie] = useState<[CategorieDepense, number][]>([])
  const [aEncaisser, setAEncaisser] = useState({ total: 0, echu: 0 })
  const [chantiers, setChantiers] = useState<ChantierFinance[]>([])
  const [erreur, setErreur] = useState('')
  const [pret, setPret] = useState(false)

  useEffect(() => {
    if (!peutGerer(profil?.role)) return
    setPret(false)
    void (async () => {
      const debut = debutPeriode(periode)
      let qf = supabase.from('factures_totaux').select('total_ttc').eq('statut', 'emise')
      let qp = supabase.from('paiements').select('montant')
      let qd = supabase.from('depenses').select('categorie, montant')
      if (debut) {
        qf = qf.gte('date_emission', debut)
        qp = qp.gte('date_paiement', debut)
        qd = qd.gte('date_depense', debut)
      }
      const [f, p, d, imp, ch] = await Promise.all([
        qf, qp, qd,
        supabase.from('factures_totaux').select('reste, date_echeance').eq('statut', 'emise').gt('reste', 0),
        supabase.from('chantier_finances').select('*'),
      ])
      const err = f.error ?? p.error ?? d.error ?? imp.error ?? ch.error
      if (err) setErreur(err.message)
      else setErreur('')
      setFacture(((f.data ?? []) as { total_ttc: number }[]).reduce((s, x) => s + x.total_ttc, 0))
      setEncaisse(((p.data ?? []) as { montant: number }[]).reduce((s, x) => s + x.montant, 0))
      const lignesDep = (d.data ?? []) as { categorie: CategorieDepense; montant: number }[]
      setDepenses(lignesDep.reduce((s, x) => s + x.montant, 0))
      const cat = new Map<CategorieDepense, number>()
      for (const x of lignesDep) cat.set(x.categorie, (cat.get(x.categorie) ?? 0) + x.montant)
      setParCategorie([...cat.entries()].sort((a, b) => b[1] - a[1]))
      const impayes = (imp.data ?? []) as { reste: number; date_echeance: string }[]
      const auj = aujourdhui()
      setAEncaisser({
        total: impayes.reduce((s, x) => s + x.reste, 0),
        echu: impayes.filter((x) => x.date_echeance < auj).reduce((s, x) => s + x.reste, 0),
      })
      setChantiers((ch.data ?? []) as ChantierFinance[])
      setPret(true)
    })()
  }, [periode, profil?.role])

  if (!peutGerer(profil?.role)) return <p className={carte}>Accès non autorisé.</p>

  const solde = encaisse - depenses
  const actifs = chantiers
    .filter((c) => c.statut === 'en_cours' || c.facture > 0 || c.depenses > 0)
    .sort((a, b) => Number(b.statut === 'en_cours') - Number(a.statut === 'en_cours') || a.titre.localeCompare(b.titre, 'fr'))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Finances</h1>
        <div className="flex gap-2">
          <Link to="/rentabilite" className={btnSec}>Rentabilité</Link>
          <Link to="/depenses" className={btnSec}>Dépenses</Link>
        </div>
      </div>

      <div className="flex gap-2">
        {(Object.keys(LIBELLE_PERIODE) as Periode[]).map((p) => (
          <button key={p} onClick={() => setPeriode(p)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${periode === p ? 'bg-nuit text-white' : 'bg-white'}`}>{LIBELLE_PERIODE[p]}</button>
        ))}
      </div>
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {!pret && !erreur && <p className="text-center text-gray-500">Chargement…</p>}

      {pret && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className={carte}><p className="text-sm text-gray-500">Facturé</p><p className="text-lg font-bold">{fcfa(facture)}</p></div>
            <div className={carte}><p className="text-sm text-gray-500">Encaissé</p><p className="text-lg font-bold">{fcfa(encaisse)}</p></div>
            <div className={carte}><p className="text-sm text-gray-500">Dépenses</p><p className="text-lg font-bold">{fcfa(depenses)}</p></div>
            <div className={carte}>
              <p className="text-sm text-gray-500">Encaissé − dépenses</p>
              <p className={`text-lg font-bold ${solde < 0 ? 'text-red-600' : 'text-green-700'}`}>{solde < 0 ? '− ' : ''}{fcfa(Math.abs(solde))}</p>
            </div>
          </div>
          <Link to="/factures" className={`${carte} block`}>
            <p className="text-sm text-gray-500">Reste à encaisser (toutes périodes)</p>
            <p className="text-lg font-bold">{fcfa(aEncaisser.total)}</p>
            {aEncaisser.echu > 0 && <p className="text-sm font-semibold text-red-600">dont {fcfa(aEncaisser.echu)} échus</p>}
          </Link>

          {parCategorie.length > 0 && (
            <div className={`${carte} space-y-2`}>
              <h2 className="font-bold">Dépenses par catégorie</h2>
              {parCategorie.map(([c, m]) => (
                <div key={c}>
                  <div className="flex justify-between text-sm"><span>{LIBELLE_DEPENSE[c]}</span><b>{fcfa(m)}</b></div>
                  <div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-chantier" style={{ width: `${Math.max(3, Math.round((m / depenses) * 100))}%` }} /></div>
                </div>
              ))}
            </div>
          )}

          <h2 className="pt-2 font-bold">Par chantier (depuis le début)</h2>
          {actifs.map((c) => {
            const marge = c.facture - c.depenses
            const depasse = c.budget_prevu > 0 && c.depenses > c.budget_prevu
            const part = c.budget_prevu > 0 ? Math.min(100, Math.round((c.depenses / c.budget_prevu) * 100)) : 0
            return (
              <Link key={c.chantier_id} to={`/chantiers/${c.chantier_id}`} className={`${carte} block space-y-2`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{c.titre}</p>
                  <span className="text-xs text-gray-500">{LIBELLE_STATUT[c.statut]}</span>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  <div className="flex justify-between"><dt className="text-gray-500">Budget</dt><dd>{c.budget_prevu > 0 ? fcfa(c.budget_prevu) : '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">Facturé</dt><dd>{fcfa(c.facture)}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">Dépenses</dt><dd className={depasse ? 'font-bold text-red-600' : ''}>{fcfa(c.depenses)}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">Encaissé</dt><dd>{fcfa(c.encaisse)}</dd></div>
                </dl>
                {c.budget_prevu > 0 && (
                  <div>
                    <div className="h-2 rounded-full bg-gray-100"><div className={`h-2 rounded-full ${depasse ? 'bg-red-500' : 'bg-chantier'}`} style={{ width: `${part}%` }} /></div>
                    <p className={`mt-1 text-xs ${depasse ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
                      {depasse ? `Budget dépassé de ${fcfa(c.depenses - c.budget_prevu)}` : `${part} % du budget dépensé`}
                    </p>
                  </div>
                )}
                {c.facture > 0 && <p className={`text-sm font-semibold ${marge < 0 ? 'text-red-600' : 'text-green-700'}`}>Marge (facturé − dépenses) : {marge < 0 ? '− ' : ''}{fcfa(Math.abs(marge))}</p>}
              </Link>
            )
          })}
          {!actifs.length && <p className="text-center text-gray-500">Aucun chantier à afficher.</p>}
          <p className="text-xs text-gray-500">Les montants facturés sont ceux des factures émises (TVA incluse si elle est appliquée). Les dépenses sont celles que vous saisissez.</p>
        </>
      )}
    </div>
  )
}
