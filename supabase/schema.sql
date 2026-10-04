-- Sprint 0 : profils, clients, chantiers, affectations + droits par rôle.
-- À exécuter une seule fois dans Supabase > SQL Editor.

create type role_utilisateur as enum ('gerant', 'secretaire', 'chef_chantier', 'ouvrier');
create type statut_chantier as enum ('a_planifier', 'en_cours', 'en_pause', 'termine', 'annule');
create type type_travaux as enum ('peinture', 'plafonnage', 'renovation', 'decoration', 'autre');

create table profils (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text not null,
  telephone text,
  role role_utilisateur not null default 'ouvrier',
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  telephone text,
  email text,
  adresse text,
  notes text,
  created_at timestamptz not null default now()
);

create table chantiers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete restrict,
  chef_id uuid references profils(id) on delete set null,
  titre text not null,
  adresse text,
  type_travaux type_travaux not null default 'autre',
  date_debut date,
  date_fin_prevue date,
  date_fin_reelle date,
  budget_prevu numeric(14,0) not null default 0,
  statut statut_chantier not null default 'a_planifier',
  avancement_pct int not null default 0 check (avancement_pct between 0 and 100),
  created_at timestamptz not null default now()
);
create index on chantiers (client_id);
create index on chantiers (chef_id);

create table affectations (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references chantiers(id) on delete cascade,
  utilisateur_id uuid not null references profils(id) on delete cascade,
  date_debut date,
  date_fin date,
  unique (chantier_id, utilisateur_id)
);

-- Rôle de l'utilisateur connecté (contourne les droits pour éviter les boucles)
create or replace function public.role_courant()
returns role_utilisateur language sql stable security definer set search_path = public as $$
  select role from profils where id = auth.uid()
$$;

-- Création automatique du profil à l'inscription. Le premier compte devient gérant.
create or replace function public.creer_profil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profils (id, nom, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom', split_part(new.email, '@', 1)),
    case when exists (select 1 from profils) then 'ouvrier' else 'gerant' end::role_utilisateur
  );
  return new;
end $$;

create trigger apres_inscription after insert on auth.users
for each row execute function public.creer_profil();

-- Droits (RLS)
alter table profils enable row level security;
alter table clients enable row level security;
alter table chantiers enable row level security;
alter table affectations enable row level security;

create policy profils_lecture on profils for select to authenticated using (true);
create policy profils_gerant on profils for all to authenticated
  using (role_courant() = 'gerant') with check (role_courant() = 'gerant');

create policy clients_lecture on clients for select to authenticated
  using (role_courant() in ('gerant', 'secretaire', 'chef_chantier'));
create policy clients_gestion on clients for all to authenticated
  using (role_courant() in ('gerant', 'secretaire'))
  with check (role_courant() in ('gerant', 'secretaire'));

create policy chantiers_lecture on chantiers for select to authenticated
  using (
    role_courant() in ('gerant', 'secretaire')
    or chef_id = auth.uid()
    or exists (select 1 from affectations a where a.chantier_id = chantiers.id and a.utilisateur_id = auth.uid())
  );
create policy chantiers_gestion on chantiers for all to authenticated
  using (role_courant() in ('gerant', 'secretaire'))
  with check (role_courant() in ('gerant', 'secretaire'));

create policy affectations_lecture on affectations for select to authenticated
  using (utilisateur_id = auth.uid() or role_courant() in ('gerant', 'secretaire'));
create policy affectations_gestion on affectations for all to authenticated
  using (role_courant() in ('gerant', 'secretaire'))
  with check (role_courant() in ('gerant', 'secretaire'));
