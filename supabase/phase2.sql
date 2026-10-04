-- Phase 2 : devis, factures, paiements, réglages de l'entreprise.
-- À exécuter une seule fois dans Supabase > SQL Editor, après schema.sql et phase1.sql.

create type statut_devis as enum ('brouillon', 'envoye', 'accepte', 'refuse');
create type statut_facture as enum ('emise', 'annulee');
create type mode_paiement as enum ('especes', 'orange_money', 'moov_money', 'virement', 'cheque');

-- Réglages de l'entreprise (une seule ligne), utilisés en en-tête des PDF
create table entreprise (
  id int primary key default 1 check (id = 1),
  nom text not null default 'Mon entreprise',
  adresse text,
  telephone text,
  email text,
  identifiants text,            -- IFU, RCCM, etc.
  conditions_paiement text,     -- texte en bas des devis et factures
  tva_defaut numeric(5,2) not null default 0
);
insert into entreprise (id) values (1);

-- Compteurs pour la numérotation (DEV-2026-001, FAC-2026-001)
create table compteurs (
  cle text primary key,
  dernier int not null default 0
);

create or replace function public.numeroter()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  prefixe text := tg_argv[0];
  cle_annee text := prefixe || '-' || extract(year from now())::int;
  n int;
begin
  insert into compteurs (cle, dernier) values (cle_annee, 1)
  on conflict (cle) do update set dernier = compteurs.dernier + 1
  returning dernier into n;
  new.numero := cle_annee || '-' || lpad(n::text, 3, '0');
  return new;
end $$;

create table devis (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique default '',
  client_id uuid not null references clients(id) on delete restrict,
  chantier_id uuid references chantiers(id) on delete set null,
  objet text not null,
  date_emission date not null default current_date,
  validite_jours int not null default 30,
  tva_pct numeric(5,2) not null default 0 check (tva_pct >= 0),
  remise numeric(14,0) not null default 0 check (remise >= 0),
  statut statut_devis not null default 'brouillon',
  notes text,
  created_by uuid references profils(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on devis (client_id);
create index on devis (chantier_id);
create trigger devis_numero before insert on devis
for each row execute function public.numeroter('DEV');

create table lignes_devis (
  id uuid primary key default gen_random_uuid(),
  devis_id uuid not null references devis(id) on delete cascade,
  position int not null default 0,
  description text not null,
  quantite numeric(12,2) not null default 1 check (quantite >= 0),
  unite text not null default 'u',
  prix_unitaire numeric(14,0) not null default 0 check (prix_unitaire >= 0)
);
create index on lignes_devis (devis_id);

create table factures (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique default '',
  client_id uuid not null references clients(id) on delete restrict,
  chantier_id uuid references chantiers(id) on delete set null,
  devis_id uuid references devis(id) on delete set null,
  objet text not null,
  date_emission date not null default current_date,
  date_echeance date not null default (current_date + 30),
  tva_pct numeric(5,2) not null default 0 check (tva_pct >= 0),
  remise numeric(14,0) not null default 0 check (remise >= 0),
  statut statut_facture not null default 'emise',
  notes text,
  created_by uuid references profils(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on factures (client_id);
create index on factures (chantier_id);
create index on factures (devis_id);
create trigger factures_numero before insert on factures
for each row execute function public.numeroter('FAC');

create table lignes_facture (
  id uuid primary key default gen_random_uuid(),
  facture_id uuid not null references factures(id) on delete cascade,
  position int not null default 0,
  description text not null,
  quantite numeric(12,2) not null default 1 check (quantite >= 0),
  unite text not null default 'u',
  prix_unitaire numeric(14,0) not null default 0 check (prix_unitaire >= 0)
);
create index on lignes_facture (facture_id);

create table paiements (
  id uuid primary key default gen_random_uuid(),
  facture_id uuid not null references factures(id) on delete cascade,
  montant numeric(14,0) not null check (montant > 0),
  mode mode_paiement not null default 'especes',
  date_paiement date not null default current_date,
  reference text,
  created_by uuid references profils(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on paiements (facture_id);

-- Totaux (security_invoker : les droits de l'utilisateur s'appliquent aux vues)
create view devis_totaux with (security_invoker = true) as
select d.*, c.nom as client_nom,
  coalesce(l.brut, 0) as total_brut,
  round((coalesce(l.brut, 0) - d.remise) * (1 + d.tva_pct / 100)) as total_ttc
from devis d
join clients c on c.id = d.client_id
left join lateral (
  select sum(quantite * prix_unitaire) as brut from lignes_devis where devis_id = d.id
) l on true;

create view factures_totaux with (security_invoker = true) as
select f.*, c.nom as client_nom,
  coalesce(l.brut, 0) as total_brut,
  round((coalesce(l.brut, 0) - f.remise) * (1 + f.tva_pct / 100)) as total_ttc,
  coalesce(p.paye, 0) as paye,
  round((coalesce(l.brut, 0) - f.remise) * (1 + f.tva_pct / 100)) - coalesce(p.paye, 0) as reste
from factures f
join clients c on c.id = f.client_id
left join lateral (
  select sum(quantite * prix_unitaire) as brut from lignes_facture where facture_id = f.id
) l on true
left join lateral (
  select sum(montant) as paye from paiements where facture_id = f.id
) p on true;

-- Refuse un paiement supérieur au reste à payer
create or replace function public.verifier_paiement()
returns trigger language plpgsql as $$
declare
  reste numeric;
  annulee boolean;
begin
  select ft.reste, ft.statut = 'annulee' into reste, annulee
  from factures_totaux ft where ft.id = new.facture_id;
  if annulee then
    raise exception 'Cette facture est annulée.';
  end if;
  if tg_op = 'UPDATE' then
    reste := reste + old.montant;
  end if;
  if new.montant > reste then
    raise exception 'Le paiement dépasse le reste à payer (% FCFA).', reste;
  end if;
  return new;
end $$;

create trigger paiements_controle before insert or update on paiements
for each row execute function public.verifier_paiement();

-- Transforme un devis en facture (copie des lignes), en une seule opération
create or replace function public.facturer_devis(p_devis uuid)
returns uuid language plpgsql as $$
declare
  d devis%rowtype;
  nouvelle uuid;
begin
  select * into d from devis where id = p_devis;
  if not found then
    raise exception 'Devis introuvable.';
  end if;
  if d.statut <> 'accepte' then
    raise exception 'Seul un devis accepté peut être facturé.';
  end if;
  insert into factures (client_id, chantier_id, devis_id, objet, tva_pct, remise, notes)
  values (d.client_id, d.chantier_id, d.id, d.objet, d.tva_pct, d.remise, d.notes)
  returning id into nouvelle;
  insert into lignes_facture (facture_id, position, description, quantite, unite, prix_unitaire)
  select nouvelle, position, description, quantite, unite, prix_unitaire
  from lignes_devis where devis_id = d.id;
  return nouvelle;
end $$;

-- Droits : réservé au gérant et à la secrétaire
alter table entreprise enable row level security;
alter table compteurs enable row level security;   -- aucune policy : accès par la fonction numeroter() uniquement
alter table devis enable row level security;
alter table lignes_devis enable row level security;
alter table factures enable row level security;
alter table lignes_facture enable row level security;
alter table paiements enable row level security;

create policy entreprise_lecture on entreprise for select to authenticated
  using (role_courant() in ('gerant', 'secretaire'));
create policy entreprise_modif on entreprise for update to authenticated
  using (role_courant() = 'gerant') with check (role_courant() = 'gerant');

create policy devis_acces on devis for all to authenticated
  using (role_courant() in ('gerant', 'secretaire'))
  with check (role_courant() in ('gerant', 'secretaire'));
create policy lignes_devis_acces on lignes_devis for all to authenticated
  using (role_courant() in ('gerant', 'secretaire'))
  with check (role_courant() in ('gerant', 'secretaire'));
create policy factures_acces on factures for all to authenticated
  using (role_courant() in ('gerant', 'secretaire'))
  with check (role_courant() in ('gerant', 'secretaire'));
create policy lignes_facture_acces on lignes_facture for all to authenticated
  using (role_courant() in ('gerant', 'secretaire'))
  with check (role_courant() in ('gerant', 'secretaire'));
create policy paiements_acces on paiements for all to authenticated
  using (role_courant() in ('gerant', 'secretaire'))
  with check (role_courant() in ('gerant', 'secretaire'));
