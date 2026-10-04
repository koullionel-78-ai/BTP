export type Role = 'gerant' | 'secretaire' | 'chef_chantier' | 'ouvrier'
export type StatutChantier = 'a_planifier' | 'en_cours' | 'en_pause' | 'termine' | 'annule'
export type TypeTravaux = 'peinture' | 'plafonnage' | 'renovation' | 'decoration' | 'autre'
export type TypePhoto = 'avant' | 'pendant' | 'apres'

export interface Profil {
  id: string
  nom: string
  telephone: string | null
  role: Role
  actif: boolean
}

export interface Client {
  id: string
  nom: string
  telephone: string | null
  email: string | null
  adresse: string | null
  notes: string | null
}

export interface Chantier {
  id: string
  client_id: string | null
  chef_id: string | null
  titre: string
  adresse: string | null
  type_travaux: TypeTravaux
  date_debut: string | null
  date_fin_prevue: string | null
  date_fin_reelle: string | null
  budget_prevu: number
  statut: StatutChantier
  avancement_pct: number
  clients?: { nom: string; telephone?: string | null } | null
}

export interface Affectation {
  id: string
  chantier_id: string
  utilisateur_id: string
}

export interface Photo {
  id: string
  chantier_id: string
  chemin: string
  type: TypePhoto
  auteur_id: string | null
  created_at: string
}

export const LIBELLE_ROLE: Record<Role, string> = {
  gerant: 'Gérant',
  secretaire: 'Secrétaire',
  chef_chantier: 'Chef de chantier',
  ouvrier: 'Ouvrier',
}
export const LIBELLE_STATUT: Record<StatutChantier, string> = {
  a_planifier: 'À planifier',
  en_cours: 'En cours',
  en_pause: 'En pause',
  termine: 'Terminé',
  annule: 'Annulé',
}
export const LIBELLE_TRAVAUX: Record<TypeTravaux, string> = {
  peinture: 'Peinture',
  plafonnage: 'Plafonnage',
  renovation: 'Rénovation',
  decoration: 'Décoration',
  autre: 'Autre',
}
export const LIBELLE_PHOTO: Record<TypePhoto, string> = {
  avant: 'Avant',
  pendant: 'Pendant',
  apres: 'Après',
}

export const peutGerer = (r?: Role) => r === 'gerant' || r === 'secretaire'

// ---- Phase 2 : devis, factures, paiements ----
export type StatutDevis = 'brouillon' | 'envoye' | 'accepte' | 'refuse'
export type StatutFacture = 'emise' | 'annulee'
export type ModePaiement = 'especes' | 'orange_money' | 'moov_money' | 'virement' | 'cheque'

export interface Entreprise {
  indicatif_pays: string
  nom: string
  adresse: string | null
  telephone: string | null
  email: string | null
  identifiants: string | null
  conditions_paiement: string | null
  tva_defaut: number
}

export interface Ligne {
  id?: string
  description: string
  quantite: number
  unite: string
  prix_unitaire: number
}

interface DocumentBase {
  id: string
  numero: string
  client_id: string
  chantier_id: string | null
  objet: string
  date_emission: string
  tva_pct: number
  remise: number
  notes: string | null
  client_nom: string
  total_brut: number
  total_ttc: number
}

export interface Devis extends DocumentBase {
  validite_jours: number
  statut: StatutDevis
}

export interface Facture extends DocumentBase {
  devis_id: string | null
  date_echeance: string
  statut: StatutFacture
  paye: number
  reste: number
}

export interface Paiement {
  id: string
  facture_id: string
  montant: number
  mode: ModePaiement
  date_paiement: string
  reference: string | null
}

export const LIBELLE_DEVIS: Record<StatutDevis, string> = {
  brouillon: 'Brouillon',
  envoye: 'Envoyé',
  accepte: 'Accepté',
  refuse: 'Refusé',
}
export const LIBELLE_MODE: Record<ModePaiement, string> = {
  especes: 'Espèces',
  orange_money: 'Orange Money',
  moov_money: 'Moov Money',
  virement: 'Virement',
  cheque: 'Chèque',
}

export type EtatFacture = 'annulee' | 'payee' | 'echue' | 'a_encaisser'
export const LIBELLE_ETAT: Record<EtatFacture, string> = {
  annulee: 'Annulée',
  payee: 'Payée',
  echue: 'Échue',
  a_encaisser: 'À encaisser',
}
export function etatFacture(f: Pick<Facture, 'statut' | 'reste' | 'date_echeance'>): EtatFacture {
  if (f.statut === 'annulee') return 'annulee'
  if (f.reste <= 0) return 'payee'
  return f.date_echeance < new Date().toISOString().slice(0, 10) ? 'echue' : 'a_encaisser'
}

// ---- Phase 3 : rapports journaliers, planning ----
export interface Rapport {
  id: string
  chantier_id: string
  date_rapport: string
  auteur_id: string | null
  avancement_pct: number
  travaux: string
  incident: string | null
  created_at: string
  chantiers?: { titre: string } | null
}

export interface AffectationDatee extends Affectation {
  date_debut: string | null
  date_fin: string | null
}

// ---- Phase 4 : stock et inventaire ----
export type TypeMouvement = 'entree' | 'sortie' | 'retour' | 'perte' | 'ajustement'

export interface Article {
  id: string
  nom: string
  categorie: string
  unite: string
  stock: number
  seuil_alerte: number
  actif: boolean
}

export interface Mouvement {
  id: string
  article_id: string
  type: TypeMouvement
  delta: number
  chantier_id: string | null
  inventaire_id: string | null
  note: string | null
  auteur_id: string | null
  created_at: string
  chantiers?: { titre: string } | null
  articles?: { nom: string; unite: string } | null
}

export interface Inventaire {
  id: string
  date_inventaire: string
  statut: 'en_cours' | 'valide'
  note: string | null
  valide_le: string | null
}

export interface LigneInventaire {
  id: string
  inventaire_id: string
  article_id: string
  stock_theorique: number
  quantite_comptee: number | null
  articles?: { nom: string; unite: string; categorie: string } | null
}

export const LIBELLE_MOUVEMENT: Record<TypeMouvement, string> = {
  entree: 'Entrée',
  sortie: 'Sortie chantier',
  retour: 'Retour chantier',
  perte: 'Perte / casse',
  ajustement: 'Ajustement',
}
export const LIBELLE_CATEGORIE: Record<string, string> = {
  peinture: 'Peinture',
  enduit: 'Enduit et plâtre',
  plafond: 'Plafond',
  colle: 'Colle et adhésif',
  outillage: 'Outillage consommable',
  quincaillerie: 'Quincaillerie',
  autre: 'Autre',
}
export const stockBas = (a: Pick<Article, 'stock' | 'seuil_alerte'>) => a.seuil_alerte > 0 && a.stock <= a.seuil_alerte

// ---- Phase 5 : métrés et suivi financier ----
export type CategorieDepense = 'materiaux' | 'main_oeuvre' | 'sous_traitance' | 'transport' | 'location' | 'autre'

export interface Depense {
  id: string
  chantier_id: string | null
  categorie: CategorieDepense
  montant: number
  date_depense: string
  description: string
  fournisseur: string | null
  chantiers?: { titre: string } | null
}

export interface Metre {
  id: string
  chantier_id: string
  piece: string
  designation: string
  unite: string
  longueur: number
  largeur: number | null
  nombre: number
  deduction: boolean
  quantite: number
  note: string | null
}

export interface ChantierFinance {
  chantier_id: string
  titre: string
  statut: StatutChantier
  budget_prevu: number
  facture: number
  encaisse: number
  depenses: number
}

export const LIBELLE_DEPENSE: Record<CategorieDepense, string> = {
  materiaux: 'Matériaux',
  main_oeuvre: "Main-d'œuvre",
  sous_traitance: 'Sous-traitance',
  transport: 'Transport',
  location: 'Location de matériel',
  autre: 'Autre',
}

// ---- Phase 6 : réception, garanties et SAV, rentabilité, bibliothèque de prix ----
export interface Reception {
  id: string
  chantier_id: string
  date_reception: string
  observations: string | null
  signataire: string
  signature: string
}

export interface Reserve {
  id: string
  reception_id: string
  description: string
  levee: boolean
  levee_le: string | null
}

export interface GarantieSuivi {
  id: string
  chantier_id: string
  chantier_titre: string
  designation: string
  duree_mois: number
  date_debut: string
  date_fin: string
  jours_restants: number
}

export type StatutSav = 'ouverte' | 'en_cours' | 'resolue' | 'refusee'
export interface SavDemande {
  id: string
  chantier_id: string
  garantie_id: string | null
  date_demande: string
  description: string
  statut: StatutSav
  sous_garantie: boolean
  resolution: string | null
  date_resolution: string | null
  chantiers?: { titre: string } | null
}
export const LIBELLE_SAV: Record<StatutSav, string> = {
  ouverte: 'Ouverte',
  en_cours: 'En cours',
  resolue: 'Résolue',
  refusee: 'Refusée',
}

export interface PrestationStats {
  id: string
  designation: string
  unite: string
  prix_unitaire: number
  type_travaux: TypeTravaux
  nb: number
  moyen: number | null
  minimum: number | null
  maximum: number | null
  dernier: number | null
  derniere_date: string | null
}

export interface Rentabilite {
  chantier_id: string
  titre: string
  statut: StatutChantier
  type_travaux: TypeTravaux
  facture: number
  dep_materiaux: number
  dep_main_oeuvre: number
  dep_sous_traitance: number
  dep_autres: number
  depenses: number
  jours_homme: number
}

// ---- Phase 7 : paie, sous-traitants, matériel, prospects, portfolio, espace client, journal ----
export type ModePaie = 'jour' | 'tache' | 'm2'
export const LIBELLE_PAIE: Record<ModePaie, string> = { jour: 'À la journée', tache: 'À la tâche', m2: 'Au m²' }
export const UNITE_PAIE: Record<ModePaie, string> = { jour: 'jours', tache: 'tâches', m2: 'm²' }

export interface Travailleur {
  id: string
  nom: string
  telephone: string | null
  mode: ModePaie
  taux: number
  actif: boolean
  avances_total: number
  avances_deduites: number
  solde_avances: number
}
export interface Avance {
  id: string
  travailleur_id: string
  montant: number
  date_avance: string
  note: string | null
}
export interface Paie {
  id: string
  travailleur_id: string
  chantier_id: string | null
  periode_debut: string
  periode_fin: string
  mode: ModePaie
  quantite: number
  taux: number
  montant: number
  avances_deduites: number
  date_paiement: string
  chantiers?: { titre: string } | null
}

export interface SousTraitant {
  id: string
  nom: string
  specialite: string | null
  telephone: string | null
  notes: string | null
  nb_evaluations: number
  qualite_moy: number | null
  delais_moy: number | null
  prix_moy: number | null
  note_globale: number | null
}

export type EtatMateriel = 'bon' | 'a_reparer' | 'hors_service'
export const LIBELLE_ETAT_MATERIEL: Record<EtatMateriel, string> = { bon: 'Bon état', a_reparer: 'À réparer', hors_service: 'Hors service' }
export interface Materiel {
  id: string
  nom: string
  reference: string | null
  etat: EtatMateriel
  chantier_id: string | null
  detenteur_id: string | null
  prochaine_maintenance: string | null
  notes: string | null
  actif: boolean
}

export type StatutProspect = 'nouveau' | 'visite' | 'devis_envoye' | 'gagne' | 'perdu'
export type SourceProspect = 'bouche_a_oreille' | 'facebook' | 'whatsapp' | 'passage' | 'autre'
export const LIBELLE_PROSPECT: Record<StatutProspect, string> = {
  nouveau: 'Nouveau', visite: 'Visite faite', devis_envoye: 'Devis envoyé', gagne: 'Gagné', perdu: 'Perdu',
}
export const LIBELLE_SOURCE: Record<SourceProspect, string> = {
  bouche_a_oreille: 'Bouche à oreille', facebook: 'Facebook', whatsapp: 'WhatsApp', passage: 'Passage', autre: 'Autre',
}
export interface Prospect {
  id: string
  nom: string
  telephone: string | null
  source: SourceProspect
  demande: string | null
  statut: StatutProspect
  date_contact: string
  date_visite: string | null
  montant_estime: number
  raison_perte: string | null
  client_id: string | null
  notes: string | null
}

export type StatutChoix = 'en_attente' | 'valide' | 'refuse'
export interface ChoixClient {
  id: string
  chantier_id: string
  libelle: string
  proposition: string
  statut: StatutChoix
  commentaire_client: string | null
  repondu_le: string | null
}

export interface JournalLigne {
  id: number
  table_name: string
  record_id: string | null
  action: 'creation' | 'modification' | 'suppression'
  utilisateur_id: string | null
  changes: Record<string, unknown> | null
  created_at: string
}
