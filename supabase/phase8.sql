-- Phase 8 : planning enrichi.
--   1. Contrôleur de chantier (suit le chantier en lecture seule)
--   2. Sous-traitants affectés aux chantiers, avec leurs dates
--   3. Rendez-vous de devis (visite, métré, remise) et date limite d'envoi d'un devis
-- À exécuter une seule fois dans Supabase > SQL Editor, après les phases 1 à 7.

-- ---------------------------------------------------------------- Contrôleur
alter table chantiers add column controleur_id uuid references profils(id) on delete set null;
create index on chantiers (controleur_id);

-- (security definer : évite une boucle de droits avec "chantiers")
create or replace function public.est_controleur_de(p_chantier uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from chantiers where id = p_chantier and controleur_id = auth.uid())
$$;

-- Le contrôleur voit le chantier (et donc ses rapports, photos et métrés : leurs droits s'appuient sur "chantiers")
drop policy chantiers_lecture on chantiers;
create policy chantiers_lecture on chantiers for select to authenticated
  using (
    role_courant() in ('gerant', 'secretaire')
    or chef_id = auth.uid()
    or controleur_id = auth.uid()
    or exists (select 1 from affectations a where a.chantier_id = chantiers.id and a.utilisateur_id = auth.uid())
  );

-- Le contrôleur voit aussi l'équipe du chantier, comme le chef
drop policy affectations_chef on affectations;
create policy affectations_chef on affectations for select to authenticated
  using (est_chef_de(chantier_id) or est_controleur_de(chantier_id));

-- ---------------------------------------------------------------- Sous-traitants sur chantier
create table affectations_st (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references chantiers(id) on delete cascade,
  sous_traitant_id uuid not null references sous_traitants(id) on delete cascade,
  mission text,
  date_debut date,
  date_fin date,
  created_by uuid references profils(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint affectations_st_dates check (date_fin is null or date_debut is null or date_fin >= date_debut)
);
create index on affectations_st (chantier_id);
create index on affectations_st (sous_traitant_id);

alter table affectations_st enable row level security;

create policy affectations_st_gestion on affectations_st for all to authenticated
  using (role_courant() in ('gerant', 'secretaire'))
  with check (role_courant() in ('gerant', 'secretaire'));
-- Le chef et le contrôleur du chantier voient les sous-traitants qui y travaillent
create policy affectations_st_lecture on affectations_st for select to authenticated
  using (est_chef_de(chantier_id) or est_controleur_de(chantier_id));

-- ---------------------------------------------------------------- Rendez-vous de devis
create type type_rdv as enum ('visite', 'metre', 'remise');
create type statut_rdv as enum ('prevu', 'fait', 'annule');

create table rendez_vous (
  id uuid primary key default gen_random_uuid(),
  type type_rdv not null default 'visite',
  date_rdv date not null,
  heure time,
  client_id uuid not null references clients(id) on delete cascade,
  devis_id uuid references devis(id) on delete set null,
  responsable_id uuid references profils(id) on delete set null,
  adresse text,
  notes text,
  statut statut_rdv not null default 'prevu',
  created_by uuid references profils(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on rendez_vous (date_rdv);
create index on rendez_vous (client_id);

alter table rendez_vous enable row level security;

create policy rendez_vous_gestion on rendez_vous for all to authenticated
  using (role_courant() in ('gerant', 'secretaire'))
  with check (role_courant() in ('gerant', 'secretaire'));
-- Le responsable du rendez-vous le voit sur son planning
create policy rendez_vous_responsable on rendez_vous for select to authenticated
  using (responsable_id = auth.uid());

-- Date limite d'envoi d'un devis (affichée sur le planning tant que le devis est en brouillon)
alter table devis add column date_limite_envoi date;

-- ---------------------------------------------------------------- Journal des modifications
create trigger journal_affectations_st after insert or update or delete on affectations_st for each row execute function public.journaliser();
create trigger journal_rendez_vous after insert or update or delete on rendez_vous for each row execute function public.journaliser();
