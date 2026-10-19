import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { carte } from '../lib/ui'
import type { Role } from '../types'

const TOUS: Role[] = ['gerant', 'secretaire', 'chef_chantier', 'ouvrier']
const GS: Role[] = ['gerant', 'secretaire']
const GSC: Role[] = ['gerant', 'secretaire', 'chef_chantier']

const GROUPES: { titre: string; liens: { to: string; titre: string; detail: string; roles: Role[] }[] }[] = [
  { titre: 'Suivi', liens: [
    { to: '/alertes', titre: 'Alertes', detail: 'Retards, stock bas, factures échues…', roles: GSC },
    { to: '/rapports', titre: 'Rapports', detail: 'Rapports journaliers', roles: TOUS },
    { to: '/planning', titre: 'Planning', detail: 'Équipes et chantiers en retard', roles: TOUS },
    { to: '/sav', titre: 'SAV et garanties', detail: 'Retouches après livraison', roles: GSC },
  ] },
  { titre: 'Commercial', liens: [
    { to: '/prospects', titre: 'Prospects', detail: 'Demandes, visites, conversion', roles: GS },
    { to: '/portfolio', titre: 'Portfolio', detail: 'Avant / après à partager', roles: GS },
    { to: '/prix', titre: 'Bibliothèque de prix', detail: 'Prix réellement facturés', roles: GS },
  ] },
  { titre: 'Argent', liens: [
    { to: '/finances', titre: 'Finances', detail: 'Facturé, encaissé, dépenses', roles: GS },
    { to: '/rentabilite', titre: 'Rentabilité', detail: 'Marge par chantier et par type', roles: GS },
    { to: '/depenses', titre: 'Dépenses', detail: 'Matériaux, transport, location…', roles: GS },
    { to: '/paie', titre: 'Paie et avances', detail: 'Personnel de chantier', roles: ['gerant'] },
  ] },
  { titre: 'Ressources', liens: [
    { to: '/stock', titre: 'Stock', detail: 'Articles et mouvements', roles: GSC },
    { to: '/inventaires', titre: 'Inventaires', detail: 'Comptage physique', roles: GS },
    { to: '/materiel', titre: 'Matériel et outillage', detail: 'Où est quoi, maintenance', roles: GSC },
    { to: '/sous-traitants', titre: 'Sous-traitants', detail: 'Évaluations qualité, délais, prix', roles: GS },
  ] },
  { titre: 'Administration', liens: [
    { to: '/equipe', titre: 'Équipe', detail: 'Comptes et rôles', roles: ['gerant'] },
    { to: '/reglages', titre: 'Réglages', detail: 'Entreprise, TVA, WhatsApp', roles: GS },
    { to: '/export', titre: 'Export Excel', detail: 'Fichiers CSV', roles: GS },
    { to: '/journal', titre: 'Journal des modifications', detail: 'Qui a changé quoi', roles: ['gerant'] },
  ] },
]

export default function Plus() {
  const { profil } = useAuth()
  if (!profil) return null
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Tous les modules</h1>
      {GROUPES.map((g) => {
        const liens = g.liens.filter((l) => l.roles.includes(profil.role))
        if (!liens.length) return null
        return (
          <div key={g.titre} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{g.titre}</h2>
            <div className="grid grid-cols-2 gap-3">
              {liens.map((l) => (
                <Link key={l.to} to={l.to} className={`${carte} block`}>
                  <p className="font-semibold">{l.titre}</p>
                  <p className="text-xs text-gray-500">{l.detail}</p>
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
