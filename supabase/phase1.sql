-- Phase 1 : photos de chantier (table + stockage). À exécuter après schema.sql.

create type type_photo as enum ('avant', 'pendant', 'apres');

create table photos_chantier (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references chantiers(id) on delete cascade,
  chemin text not null,
  type type_photo not null default 'pendant',
  legende text,
  auteur_id uuid references profils(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on photos_chantier (chantier_id);

alter table photos_chantier enable row level security;

-- Voir / ajouter des photos : quiconque voit le chantier (les droits de "chantiers" s'appliquent)
create policy photos_lecture on photos_chantier for select to authenticated
  using (exists (select 1 from chantiers c where c.id = photos_chantier.chantier_id));
create policy photos_ajout on photos_chantier for insert to authenticated
  with check (auteur_id = auth.uid()
    and exists (select 1 from chantiers c where c.id = photos_chantier.chantier_id));
create policy photos_suppression on photos_chantier for delete to authenticated
  using (auteur_id = auth.uid() or role_courant() in ('gerant', 'secretaire'));

-- Stockage privé des fichiers
insert into storage.buckets (id, name, public) values ('photos-chantier', 'photos-chantier', false)
on conflict (id) do nothing;

create policy photos_storage_lecture on storage.objects for select to authenticated
  using (bucket_id = 'photos-chantier');
create policy photos_storage_ajout on storage.objects for insert to authenticated
  with check (bucket_id = 'photos-chantier');
create policy photos_storage_suppression on storage.objects for delete to authenticated
  using (bucket_id = 'photos-chantier'
    and (owner = auth.uid() or role_courant() in ('gerant', 'secretaire')));
