-- Phase 6 : réception de chantier, garanties et SAV, rentabilité, bibliothèque de prix.
-- À exécuter une seule fois dans Supabase > SQL Editor, après phase5.sql.

create type statut_sav as enum ('ouverte', 'en_cours', 'resolue', 'refusee');

-- Réception de chantier (PV) : une par chantier, signée par le client sur téléphone
create table receptions (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null unique references chantiers(id) on delete cascade,
  date_reception date not null default current_date,
  observations text,
  signataire text not null,
  signature text not null check (signature like 'data:image/png;base64,%' and length(signature) < 300000),
  created_by uuid references profils(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table reserves (
  id uuid primary key default gen_random_uuid(),
  reception_id uuid not null references receptions(id) on delete cascade,
  description text not null,
  levee boolean not null default false,
  levee_le date
);
create index on reserves (reception_id);

-- Garanties : durée en mois à partir d'une date de début (en général la réception)
create table garanties (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references chantiers(id) on delete cascade,
  reception_id uuid references receptions(id) on delete set null,
  designation text not null,
  duree_mois int not null check (duree_mois between 1 and 240),
  date_debut date not null default current_date,
  created_by uuid references profils(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on garanties (chantier_id);

create view garanties_suivi with (security_invoker = true) as
select g.*, c.titre as chantier_titre,
  (g.date_debut + make_interval(months => g.duree_mois))::date as date_fin,
  (g.date_debut + make_interval(months => g.duree_mois))::date - current_date as jours_restants
from garanties g
join chantiers c on c.id = g.chantier_id;

-- Demandes de SAV (retouches après livraison)
create table sav_demandes (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references chantiers(id) on delete cascade,
  garantie_id uuid references garanties(id) on delete set null,
  date_demande date not null default current_date,
  description text not null,
  statut statut_sav not null default 'ouverte',
  sous_garantie boolean not null default false,
  resolution text,
  date_resolution date,
  created_by uuid references profils(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on sav_demandes (chantier_id);
create index on sav_demandes (statut);

-- Bibliothèque de prix : prestations de référence
create table prestations (
  id uuid primary key default gen_random_uuid(),
  designation text not null,
  unite text not null default 'm²',
  prix_unitaire numeric(14,0) not null default 0 check (prix_unitaire >= 0),
  type_travaux type_travaux not null default 'autre',
  actif boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index prestations_designation_actif on prestations (lower(trim(designation))) where actif;

-- Prix réels constatés : lignes des factures émises dont la description est celle de la prestation
create view prestations_stats with (security_invoker = true) as
select p.*,
  coalesce(s.nb, 0) as nb,
  s.moyen, s.minimum, s.maximum, s.dernier, s.derniere_date
from prestations p
left join lateral (
  select count(*) as nb,
    round(avg(l.prix_unitaire)) as moyen,
    min(l.prix_unitaire) as minimum,
    max(l.prix_unitaire) as maximum,
    (array_agg(l.prix_unitaire order by f.date_emission desc, f.created_at desc))[1] as dernier,
    max(f.date_emission) as derniere_date
  from lignes_facture l
  join factures f on f.id = l.facture_id
  where f.statut = 'emise' and lower(trim(l.description)) = lower(trim(p.designation))
) s on true;

-- Rentabilité : facturé, dépenses par catégorie et jours-homme (présences des rapports) par chantier
create view chantier_rentabilite with (security_invoker = true) as
select c.id as chantier_id, c.titre, c.statut, c.type_travaux,
  coalesce(f.facture, 0) as facture,
  coalesce(d.materiaux, 0) as dep_materiaux,
  coalesce(d.main_oeuvre, 0) as dep_main_oeuvre,
  coalesce(d.sous_traitance, 0) as dep_sous_traitance,
  coalesce(d.autres, 0) as dep_autres,
  coalesce(d.total, 0) as depenses,
  coalesce(j.jours, 0) as jours_homme
from chantiers c
left join lateral (
  select sum(total_ttc) as facture from factures_totaux where chantier_id = c.id and statut = 'emise'
) f on true
left join lateral (
  select sum(montant) as total,
    sum(montant) filter (where categorie = 'materiaux') as materiaux,
    sum(montant) filter (where categorie = 'main_oeuvre') as main_oeuvre,
    sum(montant) filter (where categorie = 'sous_traitance') as sous_traitance,
    sum(montant) filter (where categorie not in ('materiaux', 'main_oeuvre', 'sous_traitance')) as autres
  from depenses where chantier_id = c.id
) d on true
left join lateral (
  select count(*) as jours
  from rapport_presences rp join rapports r on r.id = rp.rapport_id where r.chantier_id = c.id
) j on true;

-- Enregistre le PV de réception en une seule opération : réception, réserves, garantie facultative,
-- passage du chantier à « terminé » (gérant et secrétaire seulement).
create or replace function public.creer_reception(
  p_chantier uuid, p_date date, p_observations text, p_signataire text, p_signature text,
  p_reserves text[], p_garantie_mois int, p_terminer boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  gestion boolean := role_courant() in ('gerant', 'secretaire');
  nouvelle uuid;
  r text;
begin
  if not (gestion or (role_courant() = 'chef_chantier' and est_chef_de(p_chantier))) then
    raise exception 'Vous ne pouvez pas enregistrer la réception de ce chantier.';
  end if;
  if exists (select 1 from receptions where chantier_id = p_chantier) then
    raise exception 'Ce chantier a déjà un procès-verbal de réception.';
  end if;
  insert into receptions (chantier_id, date_reception, observations, signataire, signature, created_by)
  values (p_chantier, p_date, nullif(trim(p_observations), ''), trim(p_signataire), p_signature, auth.uid())
  returning id into nouvelle;
  foreach r in array coalesce(p_reserves, '{}') loop
    if trim(r) <> '' then
      insert into reserves (reception_id, description) values (nouvelle, trim(r));
    end if;
  end loop;
  if coalesce(p_garantie_mois, 0) > 0 then
    if not gestion then
      raise exception 'Seuls le gérant et la secrétaire créent une garantie.';
    end if;
    insert into garanties (chantier_id, reception_id, designation, duree_mois, date_debut, created_by)
    values (p_chantier, nouvelle, 'Garantie des travaux', p_garantie_mois, p_date, auth.uid());
  end if;
  if p_terminer and gestion then
    update chantiers set statut = 'termine', avancement_pct = 100 where id = p_chantier;
  end if;
  return nouvelle;
end $$;

-- Droits
alter table receptions enable row level security;
alter table reserves enable row level security;
alter table garanties enable row level security;
alter table sav_demandes enable row level security;
alter table prestations enable row level security;

create policy receptions_lecture on receptions for select to authenticated
  using (exists (select 1 from chantiers c where c.id = receptions.chantier_id));
-- pas de policy d'écriture : la réception se crée par creer_reception() et se supprime par le gérant
create policy receptions_suppression on receptions for delete to authenticated
  using (role_courant() = 'gerant');

create policy reserves_lecture on reserves for select to authenticated
  using (exists (select 1 from receptions r where r.id = reserves.reception_id));
create policy reserves_modif on reserves for update to authenticated
  using (exists (select 1 from receptions r where r.id = reserves.reception_id
    and (role_courant() in ('gerant', 'secretaire') or (role_courant() = 'chef_chantier' and est_chef_de(r.chantier_id)))))
  with check (exists (select 1 from receptions r where r.id = reserves.reception_id
    and (role_courant() in ('gerant', 'secretaire') or (role_courant() = 'chef_chantier' and est_chef_de(r.chantier_id)))));

create policy garanties_lecture on garanties for select to authenticated
  using (role_courant() in ('gerant', 'secretaire') or (role_courant() = 'chef_chantier' and est_chef_de(chantier_id)));
create policy garanties_gestion on garanties for all to authenticated
  using (role_courant() in ('gerant', 'secretaire'))
  with check (role_courant() in ('gerant', 'secretaire'));

create policy sav_lecture on sav_demandes for select to authenticated
  using (role_courant() in ('gerant', 'secretaire') or (role_courant() = 'chef_chantier' and est_chef_de(chantier_id)));
create policy sav_ajout on sav_demandes for insert to authenticated
  with check (created_by = auth.uid() and (role_courant() in ('gerant', 'secretaire')
    or (role_courant() = 'chef_chantier' and est_chef_de(chantier_id))));
create policy sav_modif on sav_demandes for update to authenticated
  using (role_courant() in ('gerant', 'secretaire') or (role_courant() = 'chef_chantier' and est_chef_de(chantier_id)))
  with check (role_courant() in ('gerant', 'secretaire') or (role_courant() = 'chef_chantier' and est_chef_de(chantier_id)));
create policy sav_suppression on sav_demandes for delete to authenticated
  using (role_courant() = 'gerant');

create policy prestations_acces on prestations for all to authenticated
  using (role_courant() in ('gerant', 'secretaire'))
  with check (role_courant() in ('gerant', 'secretaire'));

-- Le chef de chantier imprime le PV : il doit pouvoir lire l'en-tête de l'entreprise
create policy entreprise_lecture_chef on entreprise for select to authenticated
  using (role_courant() = 'chef_chantier');
