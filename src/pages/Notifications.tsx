import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ajouterJours, aujourdhui, fcfa } from '../lib/format'
import { supabase } from '../lib/supabase'
import { carte } from '../lib/ui'
import { peutGerer } from '../types'

interface Alerte { cle: string; niveau: 'urgent' | 'info'; titre: string; detail?: string; to: string }

// Une requête qui échoue (droits, table absente) ne doit pas bloquer les autres alertes.
async function sur<T>(f: () => PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  try { const r = await f(); return r.error ? null : r.data } catch { return null }
}
const pl = (n: number, s: string, p = s + 's') => `${n} ${n > 1 ? p : s}`

export default function Notifications() {
  const { profil } = useAuth()
  const [alertes, setAlertes] = useState<Alerte[]>([])
  const [pret, setPret] = useState(false)

  useEffect(() => {
    if (!profil || profil.role === 'ouvrier') return
    const gere = peutGerer(profil.role)
    void (async () => {
      const auj = aujourdhui()
      const liste: Alerte[] = []
      const [chantiers, rapportsJour, articles, garanties, sav, materiel] = await Promise.all([
        sur(() => supabase.from('chantiers').select('id, titre, chef_id, statut, date_fin_prevue').eq('statut', 'en_cours')),
        sur(() => supabase.from('rapports').select('chantier_id').eq('date_rapport', auj)),
        sur(() => supabase.from('articles').select('nom, stock, seuil_alerte, unite').eq('actif', true).gt('seuil_alerte', 0)),
        sur(() => supabase.from('garanties_suivi').select('chantier_titre, designation, jours_restants').gte('jours_restants', 0).lte('jours_restants', 30).order('jours_restants')),
        sur(() => supabase.from('sav_demandes').select('id, statut').in('statut', ['ouverte', 'en_cours'])),
        sur(() => supabase.from('materiel').select('nom, etat, prochaine_maintenance').eq('actif', true)),
      ])

      for (const c of (chantiers ?? []) as { id: string; titre: string; date_fin_prevue: string | null }[]) {
        if (c.date_fin_prevue && c.date_fin_prevue < auj) {
          const n = Math.round((Date.parse(auj) - Date.parse(c.date_fin_prevue)) / 864e5)
          liste.push({ cle: `retard-${c.id}`, niveau: 'urgent', titre: `${c.titre} : ${pl(n, 'jour')} de retard`, detail: 'Fin prévue dépassée', to: `/chantiers/${c.id}` })
        }
      }
      const faits = new Set(((rapportsJour ?? []) as { chantier_id: string }[]).map((r) => r.chantier_id))
      const manquants = ((chantiers ?? []) as { id: string; titre: string; chef_id: string | null }[])
        .filter((c) => !faits.has(c.id) && (gere || c.chef_id === profil.id))
      if (manquants.length) liste.push({ cle: 'rapports', niveau: 'info', titre: `${pl(manquants.length, 'rapport')} à remplir aujourd'hui`, detail: manquants.map((m) => m.titre).join(', '), to: '/rapports' })

      const bas = ((articles ?? []) as { nom: string; stock: number; seuil_alerte: number; unite: string }[]).filter((a) => a.stock <= a.seuil_alerte)
      if (bas.length) liste.push({ cle: 'stock', niveau: bas.some((a) => a.stock === 0) ? 'urgent' : 'info', titre: `${pl(bas.length, 'article')} en stock bas`, detail: bas.slice(0, 4).map((a) => a.nom).join(', ') + (bas.length > 4 ? '…' : ''), to: '/stock?bas=1' })

      const g = (garanties ?? []) as { chantier_titre: string; jours_restants: number }[]
      if (g.length) liste.push({ cle: 'garanties', niveau: 'info', titre: `${pl(g.length, 'garantie')} expire${g.length > 1 ? 'nt' : ''} dans 30 jours`, detail: g.slice(0, 3).map((x) => `${x.chantier_titre} (${x.jours_restants} j)`).join(', '), to: '/sav' })
      const s = (sav ?? []) as unknown[]
      if (s.length) liste.push({ cle: 'sav', niveau: 'info', titre: `${pl(s.length, 'demande')} de SAV ouverte${s.length > 1 ? 's' : ''}`, to: '/sav' })

      const m = (materiel ?? []) as { nom: string; etat: string; prochaine_maintenance: string | null }[]
      const aFaire = m.filter((x) => x.prochaine_maintenance && x.prochaine_maintenance <= auj)
      if (aFaire.length) liste.push({ cle: 'maintenance', niveau: 'info', titre: `${pl(aFaire.length, 'maintenance')} de matériel à faire`, detail: aFaire.slice(0, 4).map((x) => x.nom).join(', '), to: '/materiel' })
      const casse = m.filter((x) => x.etat !== 'bon')
      if (casse.length) liste.push({ cle: 'casse', niveau: 'info', titre: `${pl(casse.length, 'outil')} à réparer ou hors service`, detail: casse.slice(0, 4).map((x) => x.nom).join(', '), to: '/materiel' })

      if (gere) {
        const [factures, finances, choix, prospects] = await Promise.all([
          sur(() => supabase.from('factures_totaux').select('reste, date_echeance').eq('statut', 'emise').gt('reste', 0).lt('date_echeance', auj)),
          sur(() => supabase.from('chantier_finances').select('titre, budget_prevu, depenses, statut').in('statut', ['en_cours', 'en_pause']).gt('budget_prevu', 0)),
          sur(() => supabase.from('choix_client').select('libelle, statut, repondu_le')),
          sur(() => supabase.from('prospects').select('nom, statut, date_contact').eq('statut', 'nouveau').lt('date_contact', ajouterJours(auj, -3))),
        ])
        const f = (factures ?? []) as { reste: number }[]
        if (f.length) liste.push({ cle: 'echues', niveau: 'urgent', titre: `${pl(f.length, 'facture')} échue${f.length > 1 ? 's' : ''}`, detail: `${fcfa(f.reduce((t, x) => t + x.reste, 0))} à relancer`, to: '/factures' })
        const d = ((finances ?? []) as { titre: string; budget_prevu: number; depenses: number }[]).filter((x) => x.depenses > x.budget_prevu)
        if (d.length) liste.push({ cle: 'budget', niveau: 'urgent', titre: `${pl(d.length, 'chantier')} au-dessus du budget`, detail: d.map((x) => x.titre).join(', '), to: '/finances' })
        const c = (choix ?? []) as { libelle: string; statut: string; repondu_le: string | null }[]
        const attente = c.filter((x) => x.statut === 'en_attente')
        if (attente.length) liste.push({ cle: 'choix-attente', niveau: 'info', titre: `${pl(attente.length, 'choix')} en attente de réponse du client`, to: '/chantiers' })
        const recents = c.filter((x) => x.repondu_le && x.repondu_le >= ajouterJours(auj, -7))
        if (recents.length) liste.push({ cle: 'choix-repondus', niveau: 'info', titre: `${pl(recents.length, 'réponse')} de client cette semaine`, detail: recents.slice(0, 3).map((x) => x.libelle).join(', '), to: '/chantiers' })
        const p = (prospects ?? []) as unknown[]
        if (p.length) liste.push({ cle: 'prospects', niveau: 'info', titre: `${pl(p.length, 'prospect')} à relancer`, detail: 'Nouveaux depuis plus de 3 jours', to: '/prospects' })
      }
      liste.sort((a, b) => Number(b.niveau === 'urgent') - Number(a.niveau === 'urgent'))
      setAlertes(liste)
      setPret(true)
    })()
  }, [profil?.role, profil?.id])

  if (!profil || profil.role === 'ouvrier') return <p className={carte}>Aucune alerte pour votre rôle.</p>

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Alertes</h1>
      <p className="text-sm text-gray-500">Calculées à l'ouverture de la page à partir de vos données. Actualisez pour les mettre à jour.</p>
      {!pret && <p className="text-center text-gray-500">Chargement…</p>}
      {alertes.map((a) => (
        <Link key={a.cle} to={a.to} className={`${carte} block border ${a.niveau === 'urgent' ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'}`}>
          <p className={`font-semibold ${a.niveau === 'urgent' ? 'text-red-700' : 'text-orange-800'}`}>{a.titre}</p>
          {a.detail && <p className="text-sm text-gray-600">{a.detail}</p>}
        </Link>
      ))}
      {pret && !alertes.length && <p className={`${carte} text-center text-green-700`}>Rien à signaler.</p>}
    </div>
  )
}
