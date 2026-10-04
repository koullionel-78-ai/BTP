-- Phase 3 : rapports journaliers (et dates d'affectation pour le planning).
-- À exécuter une seule fois dans Supabase > SQL Editor, après phase2.sql.

create table rapports (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references chantiers(id) on delete cascade,
  date_rapport date not null default current_date,
  auteur_id uuid references profils(id) on delete set null default auth.uid(),
  avancement_pct int not null check (avancement_pct between 0 and 100),
  travaux text not null,
  incident text,
  created_at timestamptz not null default now(),
  unique (chantier_id, date_rapport)
);
create index on rapports (date_rapport);

create table rapport_presences (
  rapport_id uuid not null references rapports(id) on delete cascade,
  utilisateur_id uuid not null references profils(id) on delete cascade,
  primary key (rapport_id, utilisateur_id)
);

-- L'avancement du chantier suit le rapport le plus récent
create or replace function public.maj_avancement()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cible uuid := coalesce(new.chantier_id, old.chantier_id);
  dernier int;
begin
  select avancement_pct into dernier from rapports
  where chantier_id = cible order by date_rapport desc, created_at desc limit 1;
  if dernier is not null then
    update chantiers set avancement_pct = dernier where id = cible;
  end if;
  return null;
end $$;

create trigger rapports_avancement after insert or update or delete on rapports
for each row execute function public.maj_avancement();

-- Droits
alter table rapports enable row level security;
alter table rapport_presences enable row level security;

-- Lecture : quiconque voit le chantier (les droits de "chantiers" s'appliquent)
create policy rapports_lecture on rapports for select to authenticated
  using (exists (select 1 from chantiers c where c.id = rapports.chantier_id));

-- Écriture : gérant, secrétaire, ou chef du chantier concerné
create policy rapports_ajout on rapports for insert to authenticated
  with check (
    auteur_id = auth.uid() and (
      role_courant() in ('gerant', 'secretaire')
      or (role_courant() = 'chef_chantier'
          and exists (select 1 from chantiers c where c.id = rapports.chantier_id and c.chef_id = auth.uid()))
    )
  );
create policy rapports_modif on rapports for update to authenticated
  using (role_courant() in ('gerant', 'secretaire') or auteur_id = auth.uid())
  with check (role_courant() in ('gerant', 'secretaire') or auteur_id = auth.uid());
create policy rapports_suppression on rapports for delete to authenticated
  using (role_courant() in ('gerant', 'secretaire') or auteur_id = auth.uid());

create policy presences_lecture on rapport_presences for select to authenticated
  using (exists (select 1 from rapports r where r.id = rapport_presences.rapport_id));
create policy presences_gestion on rapport_presences for all to authenticated
  using (exists (select 1 from rapports r where r.id = rapport_presences.rapport_id
    and (role_courant() in ('gerant', 'secretaire') or r.auteur_id = auth.uid())))
  with check (exists (select 1 from rapports r where r.id = rapport_presences.rapport_id
    and (role_courant() in ('gerant', 'secretaire') or r.auteur_id = auth.uid())));

-- Planning : le chef de chantier voit l'équipe affectée à ses chantiers.
-- (fonction security definer pour éviter une boucle de droits avec "chantiers")
create or replace function public.est_chef_de(p_chantier uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from chantiers where id = p_chantier and chef_id = auth.uid())
$$;

create policy affectations_chef on affectations for select to authenticated
  using (est_chef_de(chantier_id));

-- Dates d'affectation cohérentes
alter table affectations add constraint affectations_dates
  check (date_fin is null or date_debut is null or date_fin >= date_debut);
