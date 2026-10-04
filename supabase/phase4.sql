-- Phase 4 : stock (articles, mouvements) et inventaire.
-- À exécuter une seule fois dans Supabase > SQL Editor, après phase3.sql.

create type type_mouvement as enum ('entree', 'sortie', 'retour', 'perte', 'ajustement');
create type statut_inventaire as enum ('en_cours', 'valide');

create table articles (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  categorie text not null default 'autre',
  unite text not null default 'u',
  stock numeric(12,2) not null default 0 check (stock >= 0),
  seuil_alerte numeric(12,2) not null default 0 check (seuil_alerte >= 0),
  actif boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index articles_nom_actif on articles (lower(nom)) where actif;

create table inventaires (
  id uuid primary key default gen_random_uuid(),
  date_inventaire date not null default current_date,
  statut statut_inventaire not null default 'en_cours',
  note text,
  auteur_id uuid references profils(id) on delete set null default auth.uid(),
  valide_par uuid references profils(id) on delete set null,
  valide_le timestamptz,
  created_at timestamptz not null default now()
);
-- un seul inventaire ouvert à la fois
create unique index un_seul_inventaire_ouvert on inventaires ((true)) where statut = 'en_cours';

create table lignes_inventaire (
  id uuid primary key default gen_random_uuid(),
  inventaire_id uuid not null references inventaires(id) on delete cascade,
  article_id uuid not null references articles(id) on delete restrict,
  stock_theorique numeric(12,2) not null,
  quantite_comptee numeric(12,2) check (quantite_comptee is null or quantite_comptee >= 0),
  unique (inventaire_id, article_id)
);

-- Journal des mouvements : jamais modifié ni supprimé. delta > 0 = entrée en stock, delta < 0 = sortie.
create table mouvements_stock (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete restrict,
  type type_mouvement not null,
  delta numeric(12,2) not null check (delta <> 0),
  chantier_id uuid references chantiers(id) on delete set null,
  inventaire_id uuid references inventaires(id) on delete set null,
  note text,
  auteur_id uuid references profils(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (type not in ('entree', 'retour') or delta > 0),
  check (type not in ('sortie', 'perte') or delta < 0),
  check (type <> 'sortie' or chantier_id is not null)
);
create index on mouvements_stock (article_id, created_at desc);
create index on mouvements_stock (chantier_id);

-- Le stock ne change que par un mouvement (verrou de ligne : pas de course entre deux sorties simultanées)
create or replace function public.appliquer_mouvement()
returns trigger language plpgsql security definer set search_path = public as $$
declare courant numeric;
begin
  select stock into courant from articles where id = new.article_id for update;
  if courant is null then
    raise exception 'Article introuvable.';
  end if;
  if courant + new.delta < 0 then
    raise exception 'Stock insuffisant : % disponible.', courant;
  end if;
  perform set_config('app.stock_interne', 'on', true);
  update articles set stock = courant + new.delta where id = new.article_id;
  perform set_config('app.stock_interne', 'off', true);
  return new;
end $$;

create trigger mouvements_applique before insert on mouvements_stock
for each row execute function public.appliquer_mouvement();

create or replace function public.proteger_stock()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.stock := 0;
  elsif new.stock is distinct from old.stock and coalesce(current_setting('app.stock_interne', true), 'off') <> 'on' then
    raise exception 'Le stock se modifie par un mouvement (entrée, sortie, inventaire), pas directement.';
  end if;
  return new;
end $$;

create trigger articles_stock_protege before insert or update on articles
for each row execute function public.proteger_stock();

-- Démarre un inventaire : photographie du stock théorique de tous les articles actifs
create or replace function public.demarrer_inventaire(p_note text default null)
returns uuid language plpgsql as $$
declare nouvel uuid;
begin
  if role_courant() not in ('gerant', 'secretaire') then
    raise exception 'Réservé au gérant et à la secrétaire.';
  end if;
  if exists (select 1 from inventaires where statut = 'en_cours') then
    raise exception 'Un inventaire est déjà en cours.';
  end if;
  insert into inventaires (note) values (nullif(trim(p_note), '')) returning id into nouvel;
  insert into lignes_inventaire (inventaire_id, article_id, stock_theorique)
  select nouvel, id, stock from articles where actif;
  return nouvel;
end $$;

-- Valide l'inventaire : écart = compté − théorique du démarrage, appliqué par un mouvement « ajustement ».
-- Les mouvements faits pendant le comptage sont conservés. Les lignes non comptées sont ignorées.
create or replace function public.valider_inventaire(p_id uuid)
returns int language plpgsql as $$
declare
  inv inventaires%rowtype;
  l record;
  n int := 0;
begin
  if role_courant() <> 'gerant' then
    raise exception 'Seul le gérant peut valider un inventaire.';
  end if;
  select * into inv from inventaires where id = p_id for update;
  if not found then
    raise exception 'Inventaire introuvable.';
  end if;
  if inv.statut <> 'en_cours' then
    raise exception 'Cet inventaire est déjà validé.';
  end if;
  for l in
    select * from lignes_inventaire
    where inventaire_id = p_id and quantite_comptee is not null and quantite_comptee <> stock_theorique
  loop
    insert into mouvements_stock (article_id, type, delta, inventaire_id, note)
    values (l.article_id, 'ajustement', l.quantite_comptee - l.stock_theorique, p_id,
            'Inventaire du ' || to_char(inv.date_inventaire, 'DD/MM/YYYY'));
    n := n + 1;
  end loop;
  update inventaires set statut = 'valide', valide_par = auth.uid(), valide_le = now() where id = p_id;
  return n;
end $$;

-- Droits
alter table articles enable row level security;
alter table mouvements_stock enable row level security;
alter table inventaires enable row level security;
alter table lignes_inventaire enable row level security;

create policy articles_lecture on articles for select to authenticated
  using (role_courant() in ('gerant', 'secretaire', 'chef_chantier'));
create policy articles_ajout on articles for insert to authenticated
  with check (role_courant() in ('gerant', 'secretaire'));
create policy articles_modif on articles for update to authenticated
  using (role_courant() in ('gerant', 'secretaire'))
  with check (role_courant() in ('gerant', 'secretaire'));

-- Mouvements : le gérant et la secrétaire font tout ; le chef sort et rend du matériel pour ses chantiers
create policy mouvements_lecture on mouvements_stock for select to authenticated
  using (
    role_courant() in ('gerant', 'secretaire')
    or (role_courant() = 'chef_chantier' and (auteur_id = auth.uid() or (chantier_id is not null and est_chef_de(chantier_id))))
  );
create policy mouvements_ajout on mouvements_stock for insert to authenticated
  with check (
    auteur_id = auth.uid() and (
      role_courant() in ('gerant', 'secretaire')
      or (role_courant() = 'chef_chantier' and type in ('sortie', 'retour')
          and chantier_id is not null and est_chef_de(chantier_id))
    )
  );
-- aucune policy update/delete : le journal est définitif

create policy inventaires_lecture on inventaires for select to authenticated
  using (role_courant() in ('gerant', 'secretaire'));
create policy inventaires_ajout on inventaires for insert to authenticated
  with check (role_courant() in ('gerant', 'secretaire'));
create policy inventaires_modif on inventaires for update to authenticated
  using (role_courant() in ('gerant', 'secretaire'))
  with check (role_courant() in ('gerant', 'secretaire'));
create policy inventaires_suppression on inventaires for delete to authenticated
  using (role_courant() in ('gerant', 'secretaire') and statut = 'en_cours');

create policy lignes_inv_lecture on lignes_inventaire for select to authenticated
  using (role_courant() in ('gerant', 'secretaire'));
create policy lignes_inv_ajout on lignes_inventaire for insert to authenticated
  with check (role_courant() in ('gerant', 'secretaire'));
create policy lignes_inv_modif on lignes_inventaire for update to authenticated
  using (role_courant() in ('gerant', 'secretaire')
         and exists (select 1 from inventaires i where i.id = inventaire_id and i.statut = 'en_cours'))
  with check (role_courant() in ('gerant', 'secretaire'));
