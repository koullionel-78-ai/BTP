import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'
import { aujourdhui, fcfa } from '../lib/format'
import { carte } from '../lib/ui'
import { peutGerer, type Role } from '../types'

const MODULES: { titre: string; to?: string; roles: Role[] }[] = [
  { titre: 'Chantiers', to: '/chantiers', roles: ['gerant', 'secretaire', 'chef_chantier', 'ouvrier'] },
  { titre: 'Rapports', to: '/rapports', roles: ['gerant', 'secretaire', 'chef_chantier', 'ouvrier'] },
  { titre: 'Planning', to: '/planning', roles: ['gerant', 'secretaire', 'chef_chantier', 'ouvrier'] },
  { titre: 'Stock', to: '/stock', roles: ['gerant', 'secretaire', 'chef_chantier'] },
  { titre: 'Inventaire', to: '/inventaires', roles: ['gerant', 'secretaire'] },
  { titre: 'SAV', to: '/sav', roles: ['gerant', 'secretaire', 'chef_chantier'] },
  { titre: 'Prix', to: '/prix', roles: ['gerant', 'secretaire'] },
  { titre: 'Clients', to: '/clients', roles: ['gerant', 'secretaire', 'chef_chantier'] },
  { titre: 'Équipe', to: '/equipe', roles: ['gerant'] },
  { titre: 'Finances', to: '/finances', roles: ['gerant', 'secretaire'] },
  { titre: 'Devis', to: '/devis', roles: ['gerant', 'secretaire'] },
  { titre: 'Factures', to: '/factures', roles: ['gerant', 'secretaire'] },
  { titre: 'Réglages', to: '/reglages', roles: ['gerant', 'secretaire'] },
  { titre: 'Alertes', to: '/alertes', roles: ['gerant', 'secretaire', 'chef_chantier'] },
  { titre: 'Prospects', to: '/prospects', roles: ['gerant', 'secretaire'] },
  { titre: 'Matériel', to: '/materiel', roles: ['gerant', 'secretaire', 'chef_chantier'] },
  { titre: 'Paie', to: '/paie', roles: ['gerant'] },
  { titre: 'Tous les modules', to: '/plus', roles: ['gerant', 'secretaire', 'chef_chantier', 'ouvrier'] },
]

export default function Accueil() {
  const { profil } = useAuth()
  const [enCours, setEnCours] = useState<number | null>(null)
  const [retards, setRetards] = useState<number | null>(null)
  const [manquants, setManquants] = useState<number | null>(null)
  const [stocksBas, setStocksBas] = useState<number | null>(null)
  const [depassements, setDepassements] = useState<number | null>(null)
  const [garantiesProches, setGarantiesProches] = useState<number | null>(null)
  const [savOuverts, setSavOuverts] = useState<number | null>(null)
  const [impayes, setImpayes] = useState<{ total: number; echu: number } | null>(null)

  useEffect(() => {
    const auj = aujourdhui()
    supabase.from('chantiers').select('id', { count: 'exact', head: true }).eq('statut', 'en_cours')
      .then(({ count }) => setEnCours(count ?? 0))
    supabase.from('chantiers').select('id', { count: 'exact', head: true }).eq('statut', 'en_cours').lt('date_fin_prevue', auj)
      .then(({ count }) => setRetards(count ?? 0))
    if (profil && (peutGerer(profil.role) || profil.role === 'chef_chantier')) {
      void (async () => {
        const [c, r] = await Promise.all([
          supabase.from('chantiers').select('id, chef_id').eq('statut', 'en_cours'),
          supabase.from('rapports').select('chantier_id').eq('date_rapport', auj),
        ])
        const faits = new Set((r.data ?? []).map((x) => x.chantier_id as string))
        const miens = ((c.data ?? []) as { id: string; chef_id: string | null }[])
          .filter((x) => peutGerer(profil.role) || x.chef_id === profil.id)
        setManquants(miens.filter((x) => !faits.has(x.id)).length)
      })()
    }
    if (profil && profil.role !== 'ouvrier') {
      supabase.from('garanties_suivi').select('id', { count: 'exact', head: true }).gte('jours_restants', 0).lte('jours_restants', 30)
        .then(({ count }) => setGarantiesProches(count ?? 0))
      supabase.from('sav_demandes').select('id', { count: 'exact', head: true }).in('statut', ['ouverte', 'en_cours'])
        .then(({ count }) => setSavOuverts(count ?? 0))
      supabase.from('articles').select('stock, seuil_alerte').eq('actif', true).gt('seuil_alerte', 0)
        .then(({ data }) => setStocksBas(((data ?? []) as { stock: number; seuil_alerte: number }[]).filter((a) => a.stock <= a.seuil_alerte).length))
    }
    if (peutGerer(profil?.role)) {
      supabase.from('chantier_finances').select('budget_prevu, depenses, statut').in('statut', ['en_cours', 'en_pause']).gt('budget_prevu', 0)
        .then(({ data }) => setDepassements(((data ?? []) as { budget_prevu: number; depenses: number }[]).filter((c) => c.depenses > c.budget_prevu).length))
      supabase.from('factures_totaux').select('reste, date_echeance').eq('statut', 'emise').gt('reste', 0)
        .then(({ data }) => {
          const l = (data ?? []) as { reste: number; date_echeance: string }[]
          setImpayes({
            total: l.reduce((s, f) => s + f.reste, 0),
            echu: l.filter((f) => f.date_echeance < auj).reduce((s, f) => s + f.reste, 0),
          })
        })
    }
  }, [profil?.role, profil?.id])

  if (!profil) {
    return <p className="rounded-lg bg-red-50 p-4 text-red-700">Profil introuvable. Vérifiez que le script supabase/schema.sql a bien été exécuté.</p>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className={carte}><p className="text-sm text-gray-500">Chantiers en cours</p><p className="text-3xl font-bold">{enCours ?? '…'}</p></div>
        <div className={carte}><p className="text-sm text-gray-500">En retard</p><p className={`text-3xl font-bold ${retards ? 'text-red-600' : ''}`}>{retards ?? '…'}</p></div>
      </div>
      {manquants !== null && manquants > 0 && (
        <Link to="/rapports" className={`${carte} block border border-orange-200 bg-orange-50`}>
          <p className="font-semibold text-orange-800">{manquants} rapport{manquants > 1 ? 's' : ''} à remplir aujourd'hui</p>
        </Link>
      )}
      {stocksBas !== null && stocksBas > 0 && (
        <Link to="/stock?bas=1" className={`${carte} block border border-orange-200 bg-orange-50`}>
          <p className="font-semibold text-orange-800">{stocksBas} article{stocksBas > 1 ? 's' : ''} en stock bas</p>
        </Link>
      )}
      {((savOuverts ?? 0) > 0 || (garantiesProches ?? 0) > 0) && (
        <Link to="/sav" className={`${carte} block space-y-1 border border-orange-200 bg-orange-50`}>
          {(savOuverts ?? 0) > 0 && <p className="font-semibold text-orange-800">{savOuverts} demande{(savOuverts ?? 0) > 1 ? 's' : ''} de SAV ouverte{(savOuverts ?? 0) > 1 ? 's' : ''}</p>}
          {(garantiesProches ?? 0) > 0 && <p className="text-sm text-orange-800">{garantiesProches} garantie{(garantiesProches ?? 0) > 1 ? 's' : ''} expire{(garantiesProches ?? 0) > 1 ? 'nt' : ''} dans 30 jours</p>}
        </Link>
      )}
      {depassements !== null && depassements > 0 && (
        <Link to="/finances" className={`${carte} block border border-red-200 bg-red-50`}>
          <p className="font-semibold text-red-700">{depassements} chantier{depassements > 1 ? 's' : ''} au-dessus du budget</p>
        </Link>
      )}
      {impayes && (
        <Link to="/factures" className={`${carte} block`}>
          <p className="text-sm text-gray-500">Factures à encaisser</p>
          <p className="text-2xl font-bold">{fcfa(impayes.total)}</p>
          {impayes.echu > 0 && <p className="text-sm font-semibold text-red-600">dont {fcfa(impayes.echu)} échus</p>}
        </Link>
      )}
      <div className="grid grid-cols-2 gap-3">
        {MODULES.filter((m) => m.roles.includes(profil.role)).map((m) =>
          m.to ? (
            <Link key={m.titre} to={m.to} className={carte}><p className="font-semibold">{m.titre}</p></Link>
          ) : (
            <div key={m.titre} className={carte}><p className="font-semibold">{m.titre}</p><p className="text-sm text-gray-400">Phase 2</p></div>
          ),
        )}
      </div>
    </div>
  )
}
