-- Phase 5 : métrés et suivi financier (dépenses, marge par chantier).
-- À exécuter une seule fois dans Supabase > SQL Editor, après phase4.sql.

create type categorie_depense as enum ('materiaux', 'main_oeuvre', 'sous_traitance', 'transport', 'location', 'autre');

-- Dépenses : rattachées à un chantier, ou « frais généraux » si chantier_id est vide
create table depenses (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid references chantiers(id) on delete set null,
  categorie categorie_depense not null default 'materiaux',
  montant numeric(14,0) not null check (montant > 0),
  date_depense date not null default current_date,
  description text not null,
  fournisseur text,
  created_by uuid references profils(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on depenses (chantier_id);
create index on depenses (date_depense desc);

-- Métrés : surfaces et longueurs mesurées sur le chantier, par pièce et par poste de travaux.
-- Quantité = longueur × largeur (facultative) × nombre ; « déduction » pour portes, fenêtres, etc.
create table metres (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references chantiers(id) on delete cascade,
  piece text not null,
  designation text not null,
  unite text not null default 'm²',
  longueur numeric(10,2) not null check (longueur >= 0),
  largeur numeric(10,2) check (largeur is null or largeur >= 0),
  nombre numeric(8,2) not null default 1 check (nombre > 0),
  deduction boolean not null default false,
  quantite numeric(14,2) generated always as (
    (case when deduction then -1 else 1 end) * longueur * coalesce(largeur, 1) * nombre
  ) stored,
  note text,
  created_by uuid references profils(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on metres (chantier_id);

-- Situation financière de chaque chantier (les droits de l'utilisateur s'appliquent à la vue)
create view chantier_finances with (security_invoker = true) as
select c.id as chantier_id, c.titre, c.statut, c.budget_prevu,
  coalesce(f.facture, 0) as facture,
  coalesce(f.encaisse, 0) as encaisse,
  coalesce(d.depenses, 0) as depenses
from chantiers c
left join lateral (
  select sum(total_ttc) as facture, sum(paye) as encaisse
  from factures_totaux where chantier_id = c.id and statut = 'emise'
) f on true
left join lateral (
  select sum(montant) as depenses from depenses where chantier_id = c.id
) d on true;

-- Droits
alter table depenses enable row level security;
alter table metres enable row level security;

create policy depenses_lecture on depenses for select to authenticated
  using (role_courant() in ('gerant', 'secretaire'));
create policy depenses_ajout on depenses for insert to authenticated
  with check (role_courant() in ('gerant', 'secretaire') and created_by = auth.uid());
create policy depenses_modif on depenses for update to authenticated
  using (role_courant() in ('gerant', 'secretaire'))
  with check (role_courant() in ('gerant', 'secretaire'));
create policy depenses_suppression on depenses for delete to authenticated
  using (role_courant() = 'gerant');

-- Métrés : lisibles par quiconque voit le chantier ; écrits par le gérant, la secrétaire et le chef du chantier
create policy metres_lecture on metres for select to authenticated
  using (exists (select 1 from chantiers c where c.id = metres.chantier_id));
create policy metres_ajout on metres for insert to authenticated
  with check (
    created_by = auth.uid() and (
      role_courant() in ('gerant', 'secretaire')
      or (role_courant() = 'chef_chantier' and est_chef_de(chantier_id))
    )
  );
create policy metres_modif on metres for update to authenticated
  using (role_courant() in ('gerant', 'secretaire') or (role_courant() = 'chef_chantier' and est_chef_de(chantier_id)))
  with check (role_courant() in ('gerant', 'secretaire') or (role_courant() = 'chef_chantier' and est_chef_de(chantier_id)));
create policy metres_suppression on metres for delete to authenticated
  using (role_courant() in ('gerant', 'secretaire') or (role_courant() = 'chef_chantier' and est_chef_de(chantier_id)));
