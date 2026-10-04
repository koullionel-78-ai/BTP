# Gestion de chantiers BTP — Phase 1

Application web installable (PWA) : React, TypeScript, Tailwind, Supabase.
Ce sprint fournit : connexion, 4 rôles, tables de base, droits par rôle, installation sur téléphone.

## 1. Préparer Supabase (10 minutes)

1. Créez un compte sur supabase.com, puis un nouveau projet (région la plus proche).
2. Ouvrez **SQL Editor**, collez tout le contenu de `supabase/schema.sql` et cliquez sur **Run**.
3. Dans **Authentication > Sign In / Providers > Email**, désactivez « Confirm email » pendant les tests.
4. Dans **Project Settings > API**, copiez l'URL du projet et la clé `anon public`.

## 2. Lancer l'application

Prérequis : Node.js 20 ou plus.

```bash
cp .env.example .env.local     # puis collez l'URL et la clé anon
npm install
npm run dev
```

Ouvrez l'adresse affichée (http://localhost:5173).

## 3. Premiers pas

1. Cliquez sur « Créer un compte » : **le premier compte devient automatiquement Gérant**.
2. Les comptes suivants sont créés avec le rôle Ouvrier. Pour changer un rôle : Supabase > Table Editor > `profils` > colonne `role` (voir l’écran Équipe).
3. Une fois votre compte gérant créé, désactivez les inscriptions publiques : Authentication > Sign In / Providers > « Allow new users to sign up ». Créez ensuite les autres comptes depuis Authentication > Users > Add user.

## 4. Mettre en ligne

```bash
git init && git add . && git commit -m "Sprint 0"
```

Poussez sur GitHub, puis sur vercel.com : **Add New Project**, importez le dépôt, ajoutez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`. Le fichier `vercel.json` gère déjà les routes.

Sur Android (Chrome) : menu ⋮ > **Installer l'application**.

## 5. Vérifier que tout fonctionne

- L'accueil affiche votre nom et votre rôle.
- Le compteur « Chantiers visibles » affiche 0 (la base répond).
- Un compte Ouvrier ne voit pas les modules Clients, Devis et Équipe.

## Structure

```
supabase/schema.sql     tables, rôles, droits (RLS)
src/auth/               session et profil de l'utilisateur
src/pages/              Login, Accueil
src/components/         Layout, RequireAuth
```

Prochaine étape : phase 1 (écrans Clients, Chantiers, Équipe, photos).

## Phase 1 : clients, chantiers, équipe, photos

**Mise à jour depuis le Sprint 0**
1. Supabase > SQL Editor : exécutez `supabase/phase1.sql` (table des photos et stockage privé).
2. Remplacez votre dossier par celui-ci (gardez votre `.env.local`), puis `npm install` et `npm run dev`.

**Nouveautés**
- Clients : liste, recherche, création, fiche modifiable, chantiers du client.
- Chantiers : liste filtrable par statut, création et modification, changement de statut, affectation de l'équipe.
- Photos : envoi depuis le téléphone (avant, pendant, après), compression automatique, galerie filtrable.
- Équipe (gérant) : rôle, téléphone, activation des comptes.
- Accueil : chantiers en cours et en retard.

**Droits**
- Gérant et secrétaire : tout, sauf l'écran Équipe (gérant seul).
- Chef de chantier : voit ses chantiers, peut ajouter des photos.
- Ouvrier : voit les chantiers où il est affecté, peut ajouter des photos.

**Test conseillé**
1. Créez un compte Chef de chantier (Supabase > Users), puis mettez son rôle dans l'écran Équipe.
2. Créez un client, un chantier avec ce chef, ajoutez des photos.
3. Connectez-vous avec le compte chef : il ne voit que ce chantier.

## Phase 2 : devis, factures, paiements, PDF

**Mise à jour depuis la Phase 1**
1. Supabase > SQL Editor : exécutez `supabase/phase2.sql` (une seule fois).
2. Remplacez votre dossier par celui-ci (gardez votre `.env.local`), puis `npm install` et `npm run dev`.
3. Ouvrez **Réglages** et renseignez le nom, l'adresse, le téléphone et les identifiants de l'entreprise : ils apparaissent en en-tête des devis et factures.

**Nouveautés**
- Devis : lignes (description, quantité, unité, prix), remise, TVA, numérotation automatique (DEV-2026-001), statuts brouillon / envoyé / accepté / refusé.
- Un devis accepté se transforme en facture en un clic (les lignes sont copiées).
- Factures : numérotation automatique (FAC-2026-001), échéance, états À encaisser / Échue / Payée / Annulée, total à encaisser et total échu.
- Paiements : espèces, Orange Money, Moov Money, virement, chèque ; paiements partiels ; un paiement supérieur au reste à payer est refusé.
- PDF : bouton « Imprimer / PDF » sur chaque devis et facture. Sur téléphone comme sur ordinateur, choisissez « Enregistrer au format PDF » dans la fenêtre d'impression.
- Depuis un chantier ou un client : boutons « Nouveau devis » et « Nouvelle facture » déjà remplis.
- Accueil (gérant, secrétaire) : total des factures à encaisser et part échue.

**Droits** : devis, factures, paiements et réglages sont réservés au gérant et à la secrétaire (le chef de chantier et l'ouvrier n'y ont pas accès). Seul le gérant modifie les réglages.

**Règles à connaître**
- Une facture qui a reçu un paiement ne peut plus être modifiée ni annulée : supprimez d'abord le paiement.
- Un devis facturé ne peut plus être modifié ni supprimé.
- La TVA par défaut est à 0 %. Si l'entreprise y est soumise, saisissez le taux dans Réglages ; il se pré-remplit ensuite sur chaque document et reste modifiable.

**Test conseillé**
1. Réglages : saisissez les informations de l'entreprise.
2. Depuis un chantier : « Nouveau devis », deux ou trois lignes, enregistrez.
3. Passez le devis à « Accepté », puis « Créer la facture ».
4. Enregistrez un paiement partiel, puis le solde : l'état passe à Payée.
5. « Imprimer / PDF » : vérifiez l'en-tête, les lignes et les totaux.

## Phase 3 : rapports journaliers et planning

**Mise à jour depuis la Phase 2**
1. Supabase > SQL Editor : exécutez `supabase/phase3.sql` (une seule fois).
2. Remplacez votre dossier par celui-ci (gardez votre `.env.local`), puis `npm install` et `npm run dev`.

**Nouveautés**
- Rapports journaliers : chantier, date, avancement, travaux réalisés, présents, incident. Un seul rapport par chantier et par jour.
- L'avancement du chantier se met à jour tout seul avec le rapport le plus récent.
- Les photos du jour (envoyées depuis la fiche chantier) s'affichent dans le rapport.
- Rapports à remplir : liste des chantiers en cours sans rapport aujourd'hui, sur l'écran Rapports et sur l'accueil (gérant, secrétaire, et chef pour ses chantiers).
- Planning : vue semaine par personne, navigation d'une semaine à l'autre, semaine en cours mise en évidence, liste des chantiers en retard avec le nombre de jours.
- Dates d'affectation : sur la fiche chantier, chaque personne affectée a un « Du / Au ». Sans dates, le planning utilise celles du chantier.

**Droits**
- Écrire un rapport : gérant, secrétaire, et chef de chantier pour ses propres chantiers.
- Modifier ou supprimer un rapport : son auteur, le gérant et la secrétaire.
- Lire : toute personne qui voit le chantier (l'ouvrier lit, mais n'écrit pas).
- Planning : chacun voit ce que ses droits sur les chantiers permettent. Le chef voit l'équipe de ses chantiers, l'ouvrier voit ses propres affectations.

**À savoir**
- Un chantier sans date de début et de fin (ni dans l'affectation) n'apparaît pas dans la grille : il est listé sous « Non planifiés ».
- Les photos ne sont pas attachées au rapport : elles sont rattachées au chantier, et le rapport affiche celles prises le jour même.

**Test conseillé**
1. Fiche chantier : mettez des dates de début et de fin, affectez deux personnes avec un « Du / Au ».
2. Planning : vérifiez la grille de la semaine.
3. Connectez-vous avec le chef du chantier : Rapports > le chantier apparaît dans « À remplir aujourd'hui ». Écrivez le rapport avec un avancement de 40 %.
4. Fiche chantier : l'avancement est passé à 40 %. Le rapport de la veille se saisit en changeant la date.
5. Compte ouvrier : il voit les rapports de son chantier mais pas le bouton « Nouveau rapport ».

## Phase 4 : stock et inventaire

**Mise à jour depuis la Phase 3**
1. Supabase > SQL Editor : exécutez `supabase/phase4.sql` (une seule fois).
2. Remplacez votre dossier par celui-ci (gardez votre `.env.local`), puis `npm install` et `npm run dev`.

**Nouveautés**
- Stock : articles avec catégorie, unité, seuil d'alerte et stock initial ; recherche, filtre par catégorie, alerte « stock bas » ou « épuisé ».
- Mouvements : entrée (achat), sortie vers un chantier, retour de chantier, perte / casse. Historique complet par article.
- Le stock ne se modifie que par un mouvement : impossible de le changer à la main, et une sortie supérieure au stock disponible est refusée.
- Inventaire : le stock théorique est figé au démarrage, vous saisissez les quantités comptées, les écarts s'affichent. La validation (gérant) applique chaque écart par un mouvement « Ajustement ».
- Fiche chantier : liste des matériaux utilisés (sorties moins retours).
- Accueil : nombre d'articles en stock bas.

**Droits**
- Gérant et secrétaire : tout sur le stock et les inventaires ; seul le gérant valide un inventaire.
- Chef de chantier : voit le stock, enregistre des sorties et retours pour ses propres chantiers.
- Ouvrier : pas d'accès au stock.

**À savoir**
- Un article ne se supprime pas : « Retirer de la liste » le masque (l'historique est conservé).
- Un seul inventaire peut être ouvert à la fois. L'inventaire abandonné ne change pas le stock.
- Écart = quantité comptée − stock théorique du démarrage. Les mouvements faits pendant le comptage sont conservés, mais si un article a bougé avant votre comptage physique, l'écart serait faussé : l'écran le signale (« mouvement depuis le début »). Idéal : inventorier le soir ou sans activité, et valider le jour même.
- Les articles non comptés restent inchangés à la validation.
- Le journal des mouvements est définitif : pour corriger une erreur de saisie, enregistrez un mouvement inverse (ou faites un inventaire).

**Test conseillé**
1. Stock > Nouvel article (ex. Peinture blanche 20 L, seuil 3, stock initial 10).
2. Fiche article : sortie de 8 vers un chantier → l'alerte « stock bas » apparaît, sur l'accueil aussi.
3. Essayez une sortie de 50 : elle est refusée.
4. Fiche chantier : « Matériaux utilisés » affiche 8.
5. Stock > Inventaire > Démarrer, comptez 1 au lieu de 2, validez avec le compte gérant : le stock passe à 1 avec un mouvement « Ajustement ».
6. Compte chef de chantier : il peut sortir du matériel pour son chantier, mais ne voit pas l'inventaire.

## Phase 5 : métrés et suivi financier

**Mise à jour depuis la Phase 4**
1. Supabase > SQL Editor : exécutez `supabase/phase5.sql` (une seule fois).
2. Remplacez votre dossier par celui-ci (gardez votre `.env.local`), puis `npm install` et `npm run dev`.

**Nouveautés**
- Métrés (fiche chantier > Métrés) : mesures par pièce et par poste de travaux (ex. Salon · Peinture murs). Quantité = longueur × largeur (facultative) × nombre ; case « À déduire » pour les portes et fenêtres. Totaux par poste (mesuré, déduit, net) et bouton Imprimer / PDF.
- Dépenses : matériaux, main-d'œuvre, sous-traitance, transport, location, autre ; rattachées à un chantier ou en « frais généraux » ; filtres par chantier et catégorie.
- Finances : facturé, encaissé, dépenses et « encaissé − dépenses » sur le mois, l'année ou depuis le début ; reste à encaisser ; dépenses par catégorie ; situation de chaque chantier (budget, facturé, encaissé, dépenses, marge, alerte budget dépassé).
- Fiche chantier : carte Métrés et carte Finances du chantier (gérant, secrétaire).
- Accueil : alerte quand des chantiers en cours dépassent leur budget.

**Droits**
- Finances et dépenses : gérant et secrétaire ; seul le gérant supprime une dépense.
- Métrés : lisibles par quiconque voit le chantier ; écrits par le gérant, la secrétaire et le chef du chantier.

**À savoir**
- La marge est « facturé − dépenses saisies ». Si vous appliquez la TVA, le facturé est TTC et les dépenses sont au montant que vous saisissez : choisissez une convention (HT ou TTC) et gardez-la pour les dépenses.
- Les sorties de stock ne créent pas de dépense : le stock n'a pas de prix. Saisissez l'achat de matériaux en dépense.
- Le budget prévu se règle dans la fiche du chantier (Modifier).
- Une dépense ne se modifie pas : supprimez-la (gérant) et saisissez-la de nouveau.

**Test conseillé**
1. Chantier > Métrés : ajoutez un mur 12 × 2,5 (Salon · Peinture murs), puis une porte 0,9 × 2,1 à déduire. Le total net du poste doit être 27,9 m².
2. Dépenses : saisissez 150 000 FCFA de matériaux sur ce chantier, avec un budget prévu plus bas : l'alerte apparaît sur la fiche, sur Finances et sur l'accueil.
3. Finances : comparez « Ce mois » et « Tout ».
4. Compte chef de chantier : il peut ajouter des métrés sur son chantier, mais Finances n'apparaît pas.

## Phase 6 : réception, garanties et SAV, rentabilité, bibliothèque de prix

**Mise à jour depuis la Phase 5**
1. Supabase > SQL Editor : exécutez `supabase/phase6.sql` (une seule fois). Les fichiers phase1 à phase5 n'ont pas changé.
2. Remplacez votre dossier par celui-ci (gardez votre `.env.local`), puis `npm install` et `npm run dev`.

**Correctif important** : les archives des phases 4 et 5 contenaient des déclarations en double (`App.tsx`, `types.ts`, une ancienne page Stock et une ancienne alerte de stock sur l'accueil) qui empêchaient l'application de compiler. Tout est nettoyé dans cette archive, qui contient le projet complet : utilisez-la à la place des précédentes.

**Nouveautés**
- Réception de chantier (fiche chantier > Enregistrer la réception) : procès-verbal avec date, observations, réserves, signature du client au doigt sur téléphone, garantie facultative en mois, passage du chantier à « terminé » (gérant, secrétaire). Un seul PV par chantier, imprimable en PDF ; les réserves se cochent comme levées ensuite.
- Garanties et SAV : suivi des garanties avec jours restants, demandes de retouches après livraison (ouverte, en cours, résolue, refusée), indication sous garantie / hors garantie. L'accueil signale les demandes ouvertes et les garanties qui expirent dans 30 jours.
- Bibliothèque de prix : prestations de référence (désignation, unité, prix, type de travaux) avec les prix réellement facturés (nombre, moyen, min, max, dernier). Dans un devis ou une facture, le menu « Ajouter depuis la bibliothèque de prix » crée la ligne.
- Rentabilité (Finances > Rentabilité) : pour chaque chantier, facturé, dépenses par catégorie, marge, et jours-homme ; synthèse par type de travaux pour voir ce qui rapporte vraiment.

**Droits**
- Réception : gérant, secrétaire, et chef du chantier concerné. Seuls le gérant et la secrétaire créent une garantie ou terminent le chantier ; seul le gérant supprime un PV.
- Garanties, SAV : gérant, secrétaire ; le chef voit et saisit pour ses chantiers.
- Bibliothèque de prix, rentabilité : gérant et secrétaire.

**À savoir**
- Les prix réels se calculent à partir des lignes de factures émises dont la description est identique (à la casse près) à la désignation de la prestation : utilisez le menu de la bibliothèque pour créer vos lignes.
- Les jours-homme comptent les présences saisies dans les rapports journaliers ; ils valent ce que valent ces rapports.
- La signature est enregistrée comme image dans la base : elle n'a pas de valeur de signature électronique légale, elle atteste d'un accord sur place.

**Test conseillé**
1. Prix : créez « Peinture murs, 2 couches » (m², 1 500 FCFA), puis utilisez-la dans un devis.
2. Sur un chantier : Enregistrer la réception, ajoutez une réserve, faites signer avec le doigt, garantie de 12 mois, cochez « terminer ».
3. Garanties et SAV : la garantie apparaît avec ses jours restants ; ajoutez une demande de SAV sous garantie.
4. Rentabilité : le chantier apparaît avec sa marge (il faut des factures et des dépenses).

## Phase 7 : paie, sous-traitants, matériel, prospects, portfolio, espace client, alertes, journal, export

**Mise à jour depuis la phase 6**
1. Supabase > SQL Editor : exécutez `supabase/phase7.sql`, une seule fois. Vérifiez ensuite dans Table Editor que les tables `travailleurs`, `paies`, `prospects`, `espaces_client` et `journal` existent.
2. Remplacez votre dossier (gardez `.env.local`), puis `npm install` et `npm run dev`.

**Nouveautés**
- **Paie et avances** (gérant) : personnel de chantier sans compte, paie à la journée, à la tâche ou au m², avances déduites de la paie, coût brut enregistré automatiquement en dépense « main-d'œuvre ».
- **Sous-traitants** (gérant, secrétaire) : évaluations qualité, délais, prix (1 à 5), moyennes.
- **Matériel et outillage** : où est quoi, état, historique des déplacements, maintenances et prochaine échéance.
- **Prospects** : demandes, visites, devis envoyés, gagné ou perdu, taux de conversion, création du client en un clic.
- **Portfolio** : réalisations avant / après, partage WhatsApp (liens de photos valables 7 jours).
- **Espace client** : depuis une fiche chantier, un lien de suivi (sans compte) où le client voit l'avancement et valide ses choix de couleurs et de matériaux.
- **WhatsApp** : boutons sur les devis, les factures (relance automatique si échue), les prospects et l'espace client. Réglages > indicatif du pays (226 pour le Burkina Faso).
- **Alertes** : retards, rapports manquants, stock bas, garanties qui expirent, factures échues, budgets dépassés, maintenance, prospects à relancer.
- **Journal des modifications** (gérant) : qui a créé, modifié ou supprimé prix, factures, paiements, dépenses, stock, paie.
- **Export** : fichiers CSV pour Excel. Menu **Plus** : accès à tous les modules, classés.

**Droits**
- Paie, avances, journal : gérant seul.
- Sous-traitants, prospects, portfolio, espace client, export : gérant et secrétaire.
- Matériel : lu par le gérant, la secrétaire et les chefs de chantier ; modifié par le gérant et la secrétaire.

**À savoir**
- Le lien de suivi client est secret mais sans mot de passe : toute personne qui le possède y accède. Il ne montre ni montants, ni photos, ni rapports détaillés. Vous pouvez le désactiver ou en créer un nouveau.
- WhatsApp : l'application prépare le message ; le PDF d'un devis ou d'une facture se joint à la main (Imprimer / PDF, enregistrer, puis ajouter dans la conversation).
- Les exports CSV ne remplacent pas une sauvegarde de la base : activez les sauvegardes dans Supabase.

**Test conseillé**
1. Paie > Personnel : ajoutez un ouvrier (8 000 FCFA par jour). Avances : 10 000. Paies : 5 jours avec 10 000 d'avances déduites. Vérifiez « À remettre » 30 000 et la dépense de 40 000 dans Dépenses.
2. Chantier > Espace client : créez le lien et un choix « Couleur du salon ». Ouvrez le lien dans une fenêtre privée : le client voit le suivi et valide. Le gérant voit la réponse sur la fiche chantier.
3. Prospects : ajoutez un prospect, passez-le à « Visite faite », puis « Créer le client ».
4. Devis : le bouton WhatsApp ouvre un message prêt à envoyer au client.
5. Journal : modifiez un prix dans la bibliothèque, puis vérifiez l'entrée.
