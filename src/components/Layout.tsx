import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { LIBELLE_ROLE, type Role } from '../types'

const LIENS: { to: string; label: string; roles: Role[] }[] = [
  { to: '/', label: 'Accueil', roles: ['gerant', 'secretaire', 'chef_chantier', 'ouvrier'] },
  { to: '/chantiers', label: 'Chantiers', roles: ['gerant', 'secretaire', 'chef_chantier', 'ouvrier'] },
  { to: '/rapports', label: 'Rapports', roles: ['gerant', 'secretaire', 'chef_chantier', 'ouvrier'] },
  { to: '/planning', label: 'Planning', roles: ['gerant', 'secretaire', 'chef_chantier', 'ouvrier'] },
  { to: '/stock', label: 'Stock', roles: ['gerant', 'secretaire', 'chef_chantier'] },
  { to: '/inventaires', label: 'Inventaire', roles: ['gerant', 'secretaire'] },
  { to: '/sav', label: 'SAV', roles: ['gerant', 'secretaire', 'chef_chantier'] },
  { to: '/clients', label: 'Clients', roles: ['gerant', 'secretaire', 'chef_chantier'] },
  { to: '/finances', label: 'Finances', roles: ['gerant', 'secretaire'] },
  { to: '/prix', label: 'Prix', roles: ['gerant', 'secretaire'] },
  { to: '/devis', label: 'Devis', roles: ['gerant', 'secretaire'] },
  { to: '/factures', label: 'Factures', roles: ['gerant', 'secretaire'] },
  { to: '/equipe', label: 'Équipe', roles: ['gerant'] },
  { to: '/reglages', label: 'Réglages', roles: ['gerant', 'secretaire'] },
  { to: '/alertes', label: 'Alertes', roles: ['gerant', 'secretaire', 'chef_chantier'] },
  { to: '/plus', label: 'Plus', roles: ['gerant', 'secretaire', 'chef_chantier', 'ouvrier'] },
]

export default function Layout() {
  const { profil, deconnexion } = useAuth()
  return (
    <div className="min-h-screen" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <header className="no-print bg-nuit px-4 pb-2 text-white" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <p className="text-lg font-bold">Gestion de chantiers</p>
            {profil && <p className="text-sm text-chantier">{profil.nom} · {LIBELLE_ROLE[profil.role]}</p>}
          </div>
          <button onClick={deconnexion} className="rounded-lg border border-white/30 px-3 py-1.5 text-sm">Déconnexion</button>
        </div>
        <nav className="mx-auto mt-2 flex max-w-3xl gap-4 overflow-x-auto">
          {LIENS.filter((l) => profil && l.roles.includes(profil.role)).map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) => `whitespace-nowrap border-b-2 pb-1 text-sm font-semibold ${isActive ? 'border-chantier text-white' : 'border-transparent text-white/60'}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl p-4">
        <Outlet />
      </main>
    </div>
  )
}
