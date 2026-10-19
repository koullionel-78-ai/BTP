-- Phase 9 : historique de présence des sous-traitants sur les chantiers
--           + correction : le chef et le contrôleur voient le nom des sous-traitants de leur chantier.
-- À exécuter une seule fois dans Supabase > SQL Editor, après phase8.sql.

-- ---------------------------------------------------------------- Présences des sous-traitants
create table presences_st (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references chantiers(id) on delete cascade,
  sous_traitant_id uuid not null references sous_traitants(id) on delete cascade,
  date_presence date not null default current_date,
  note text,
  created_by uuid references profils(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (chantier_id, sous_traitant_id, date_presence)
);
create index on presences_st (chantier_id, date_presence);
create index on presences_st (sous_traitant_id, date_presence);

alter table presences_st enable row level security;

-- Lecture : gérant, secrétaire, chef et contrôleur du chantier
create policy presences_st_lecture on presences_st for select to authenticated
  using (role_courant() in ('gerant', 'secretaire') or est_chef_de(chantier_id) or est_controleur_de(chantier_id));

-- Pointage : gérant, secrétaire, ou chef du chantier concerné
create policy presences_st_ajout on presences_st for insert to authenticated
  with check (
    created_by = auth.uid() and (role_courant() in ('gerant', 'secretaire') or est_chef_de(chantier_id))
  );

-- Suppression : gérant, secrétaire, ou la personne qui a pointé
create policy presences_st_suppression on presences_st for delete to authenticated
  using (role_courant() in ('gerant', 'secretaire') or created_by = auth.uid());

create trigger journal_presences_st after insert or update or delete on presences_st
for each row execute function public.journaliser();

-- ---------------------------------------------------------------- Correction de la phase 8
-- Le chef et le contrôleur voyaient une affectation sans le nom du sous-traitant
-- (la table des sous-traitants est réservée au gérant et à la secrétaire).
-- Ils peuvent maintenant lire la fiche des sous-traitants affectés à leur chantier, et seulement ceux-là.
create policy sous_traitants_lecture_chantier on sous_traitants for select to authenticated
  using (exists (
    select 1 from affectations_st a
    where a.sous_traitant_id = sous_traitants.id
      and (est_chef_de(a.chantier_id) or est_controleur_de(a.chantier_id))
  ));
