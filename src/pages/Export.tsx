import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { telechargerCsv } from '../lib/csv'
import { aujourdhui } from '../lib/format'
import { supabase } from '../lib/supabase'
import { btn, btnSec, carte } from '../lib/ui'
import { peutGerer } from '../types'

type Ligne = Record<string, unknown>
interface Jeu {
  cle: string
  titre: string
  table: string
  select: string
  ordre: string
  colonnes: { titre: string; cle: string }[]
  aplatir?: (l: Ligne) => Ligne
  gerantSeul?: boolean
}

const col = (cle: string, titre = cle) => ({ cle, titre })

const JEUX: Jeu[] = [
  { cle: 'factures', titre: 'Factures', table: 'factures_totaux', select: '*', ordre: 'date_emission',
    colonnes: [col('numero', 'Numéro'), col('client_nom', 'Client'), col('objet', 'Objet'), col('date_emission', 'Date'), col('date_echeance', 'Échéance'), col('statut', 'Statut'), col('total_ttc', 'Total TTC'), col('paye', 'Payé'), col('reste', 'Reste')] },
  { cle: 'devis', titre: 'Devis', table: 'devis_totaux', select: '*', ordre: 'date_emission',
    colonnes: [col('numero', 'Numéro'), col('client_nom', 'Client'), col('objet', 'Objet'), col('date_emission', 'Date'), col('statut', 'Statut'), col('total_ttc', 'Total TTC')] },
  { cle: 'paiements', titre: 'Paiements reçus', table: 'paiements', select: '*, factures(numero)', ordre: 'date_paiement',
    aplatir: (l) => ({ ...l, facture: (l.factures as { numero: string } | null)?.numero }),
    colonnes: [col('date_paiement', 'Date'), col('facture', 'Facture'), col('montant', 'Montant'), col('mode', 'Mode'), col('reference', 'Référence')] },
  { cle: 'depenses', titre: 'Dépenses', table: 'depenses', select: '*, chantiers(titre)', ordre: 'date_depense',
    aplatir: (l) => ({ ...l, chantier: (l.chantiers as { titre: string } | null)?.titre ?? 'Frais généraux' }),
    colonnes: [col('date_depense', 'Date'), col('chantier', 'Chantier'), col('categorie', 'Catégorie'), col('montant', 'Montant'), col('description', 'Description'), col('fournisseur', 'Fournisseur')] },
  { cle: 'clients', titre: 'Clients', table: 'clients', select: '*', ordre: 'nom',
    colonnes: [col('nom', 'Nom'), col('telephone', 'Téléphone'), col('email', 'E-mail'), col('adresse', 'Adresse'), col('notes', 'Notes')] },
  { cle: 'chantiers', titre: 'Chantiers', table: 'chantiers', select: '*', ordre: 'created_at',
    colonnes: [col('titre', 'Titre'), col('statut', 'Statut'), col('type_travaux', 'Type de travaux'), col('date_debut', 'Début'), col('date_fin_prevue', 'Fin prévue'), col('date_fin_reelle', 'Fin réelle'), col('budget_prevu', 'Budget prévu'), col('avancement_pct', 'Avancement %')] },
  { cle: 'stock', titre: 'Stock actuel', table: 'articles', select: '*', ordre: 'nom',
    colonnes: [col('nom', 'Article'), col('categorie', 'Catégorie'), col('unite', 'Unité'), col('stock', 'Stock'), col('seuil_alerte', "Seuil d'alerte")] },
  { cle: 'mouvements', titre: 'Mouvements de stock', table: 'mouvements_stock', select: '*, articles(nom, unite), chantiers(titre)', ordre: 'created_at',
    aplatir: (l) => ({ ...l, article: (l.articles as { nom: string } | null)?.nom, chantier: (l.chantiers as { titre: string } | null)?.titre }),
    colonnes: [col('created_at', 'Date'), col('article', 'Article'), col('type', 'Type'), col('delta', 'Quantité'), col('chantier', 'Chantier'), col('note', 'Note')] },
  { cle: 'paies', titre: 'Paies', table: 'paies', select: '*, travailleurs(nom), chantiers(titre)', ordre: 'date_paiement', gerantSeul: true,
    aplatir: (l) => ({ ...l, personne: (l.travailleurs as { nom: string } | null)?.nom, chantier: (l.chantiers as { titre: string } | null)?.titre }),
    colonnes: [col('date_paiement', 'Date'), col('personne', 'Personne'), col('chantier', 'Chantier'), col('periode_debut', 'Du'), col('periode_fin', 'Au'), col('quantite', 'Quantité'), col('taux', 'Taux'), col('montant', 'Brut'), col('avances_deduites', 'Avances déduites')] },
]

export default function Export() {
  const { profil } = useAuth()
  const [enCours, setEnCours] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  if (!peutGerer(profil?.role)) return <p className={carte}>Accès non autorisé.</p>
  const jeux = JEUX.filter((j) => !j.gerantSeul || profil?.role === 'gerant')

  // Lecture par pages de 1 000 lignes : pas de limite cachée
  async function telecharger(j: Jeu): Promise<boolean> {
    setEnCours(j.cle); setMsg('')
    const toutes: Ligne[] = []
    for (let debut = 0; ; debut += 1000) {
      const { data, error } = await supabase.from(j.table).select(j.select).order(j.ordre).range(debut, debut + 999)
      if (error) { setMsg(`${j.titre} : ${error.message}`); setEnCours(null); return false }
      const page = (data ?? []) as unknown as Ligne[]
      toutes.push(...page)
      if (page.length < 1000) break
    }
    telechargerCsv(`${j.cle}-${aujourdhui()}.csv`, j.colonnes, toutes.map((l) => (j.aplatir ? j.aplatir(l) : l)))
    setEnCours(null)
    return true
  }

  async function toutTelecharger() {
    for (const j of jeux) {
      if (!(await telecharger(j))) return
      await new Promise((r) => setTimeout(r, 400))
    }
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Export des données</h1>
      <p className="text-sm text-gray-500">Fichiers CSV qui s'ouvrent dans Excel. Pour un PDF, utilisez « Imprimer / PDF » sur un devis, une facture, un PV ou les métrés.</p>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      {jeux.map((j) => (
        <div key={j.cle} className={`${carte} flex items-center justify-between gap-2`}>
          <p className="font-semibold">{j.titre}</p>
          <button className={btnSec} disabled={enCours !== null} onClick={() => void telecharger(j)}>{enCours === j.cle ? 'Patientez…' : 'Télécharger'}</button>
        </div>
      ))}
      <button className={btn} disabled={enCours !== null} onClick={() => void toutTelecharger()}>Tout télécharger</button>
      <p className="text-xs text-gray-500">« Tout télécharger » lance plusieurs téléchargements à la suite : votre navigateur peut demander l'autorisation.</p>
      <p className={`${carte} text-sm text-gray-600`}>Ces exports sont des copies de confort, pas une sauvegarde de la base. La sauvegarde complète se gère dans Supabase (Database &gt; Backups) : vérifiez ce que votre offre inclut.</p>
    </div>
  )
}
