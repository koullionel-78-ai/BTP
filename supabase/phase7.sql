-- Phase 7 : paie et avances, sous-traitants, matériel, prospects, portfolio,
-- espace client (lien de suivi), journal des modifications, indicatif WhatsApp.
-- À exécuter une seule fois dans Supabase > SQL Editor, après phase6.sql.

-- ---------------------------------------------------------------- WhatsApp
alter table entreprise add column indicatif_pays text not null default '226' check (indicatif_pays ~ '^[0-9]{1,4}$');

-- ---------------------------------------------------------------- Paie et avances (gérant seulement)
create type mode_paie as enum ('jour', 'tache', 'm2');

create table travailleurs (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  telephone text,
  mode mode_paie not null default 'jour',
  taux numeric(14,0) not null default 0 check (taux >= 0),
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table avances (
  id uuid primary key default gen_random_uuid(),
  travailleur_id uuid not null references travailleurs(id) on delete restrict,
  montant numeric(14,0) not null check (montant > 0),
  date_avance date not null default current_date,
  note text,
  created_by uuid references profils(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on avances (travailleur_id);

create table paies (
  id uuid primary key default gen_random_uuid(),
  travailleur_id uuid not null references travailleurs(id) on delete restrict,
  chantier_id uuid references chantiers(id) on delete set null,
  periode_debut date not null,
  periode_fin date not null,
  mode mode_paie not null,
  quantite numeric(10,2) not null check (quantite > 0),
  taux numeric(14,0) not null check (taux >= 0),
  montant numeric(14,0) generated always as (round(quantite * taux)) stored,
  avances_deduites numeric(14,0) not null default 0 check (avances_deduites >= 0),
  date_paiement date not null default current_date,
  depense_id uuid references depenses(id) on delete set null,
  created_by uuid references profils(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (periode_fin >= periode_debut),
  check (avances_deduites <= round(quantite * taux))
);
create index on paies (travailleur_id, date_paiement desc);

create view travailleurs_soldes with (security_invoker = true) as
select t.*,
  coalesce(a.total, 0) as avances_total,
  coalesce(p.deduit, 0) as avances_deduites,
  coalesce(a.total, 0) - coalesce(p.deduit, 0) as solde_avances
from travailleurs t
left join lateral (select sum(montant) as total from avances where travailleur_id = t.id) a on true
left join lateral (select sum(avances_deduites) as deduit from paies where travailleur_id = t.id) p on true;

-- Enregistre une paie ; le coût brut devient une dépense « main-d'œuvre » (les avances ne sont pas des dépenses :
-- elles sont déjà comprises dans le montant brut de la paie où elles sont déduites).
create or replace function public.enregistrer_paie(
  p_travailleur uuid, p_chantier uuid, p_debut date, p_fin date, p_mode mode_paie,
  p_quantite numeric, p_taux numeric, p_avances numeric, p_date date, p_depense boolean
) returns uuid language plpgsql as $$
declare
  t record;
  brut numeric := round(p_quantite * p_taux);
  nouvelle uuid;
  dep uuid;
begin
  if role_courant() <> 'gerant' then
    raise exception 'Réservé au gérant.';
  end if;
  select nom, solde_avances into t from travailleurs_soldes where id = p_travailleur;
  if not found then
    raise exception 'Travailleur introuvable.';
  end if;
  if p_avances > t.solde_avances then
    raise exception 'Les avances à déduire (%) dépassent le solde d''avances (%).', p_avances, t.solde_avances;
  end if;
  if p_avances > brut then
    raise exception 'Les avances à déduire dépassent le montant de la paie.';
  end if;
  insert into paies (travailleur_id, chantier_id, periode_debut, periode_fin, mode, quantite, taux, avances_deduites, date_paiement)
  values (p_travailleur, p_chantier, p_debut, p_fin, p_mode, p_quantite, p_taux, coalesce(p_avances, 0), p_date)
  returning id into nouvelle;
  if p_depense and brut > 0 then
    insert into depenses (chantier_id, categorie, montant, date_depense, description)
    values (p_chantier, 'main_oeuvre', brut, p_date, 'Paie — ' || t.nom || ' (' || to_char(p_debut, 'DD/MM') || ' au ' || to_char(p_fin, 'DD/MM/YYYY') || ')')
    returning id into dep;
    update paies set depense_id = dep where id = nouvelle;
  end if;
  return nouvelle;
end $$;

create or replace function public.supprimer_paie(p_id uuid)
returns void language plpgsql as $$
declare dep uuid;
begin
  if role_courant() <> 'gerant' then
    raise exception 'Réservé au gérant.';
  end if;
  select depense_id into dep from paies where id = p_id;
  delete from paies where id = p_id;
  if dep is not null then
    delete from depenses where id = dep;
  end if;
end $$;

-- Une avance déjà déduite d'une paie ne peut pas être supprimée
create or replace function public.verifier_suppression_avance()
returns trigger language plpgsql as $$
declare reste numeric;
begin
  select coalesce((select sum(montant) from avances where travailleur_id = old.travailleur_id), 0) - old.montant
       - coalesce((select sum(avances_deduites) from paies where travailleur_id = old.travailleur_id), 0)
  into reste;
  if reste < 0 then
    raise exception 'Cette avance a déjà été déduite d''une paie : supprimez d''abord la paie concernée.';
  end if;
  return old;
end $$;
create trigger avances_suppression before delete on avances
for each row execute function public.verifier_suppression_avance();

-- ---------------------------------------------------------------- Sous-traitants
create table sous_traitants (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  specialite text,
  telephone text,
  notes text,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index sous_traitants_nom_actif on sous_traitants (lower(trim(nom))) where actif;

create table evaluations_st (
  id uuid primary key default gen_random_uuid(),
  sous_traitant_id uuid not null references sous_traitants(id) on delete cascade,
  chantier_id uuid references chantiers(id) on delete set null,
  qualite int not null check (qualite between 1 and 5),
  delais int not null check (delais between 1 and 5),
  prix int not null check (prix between 1 and 5),
  commentaire text,
  created_by uuid references profils(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on evaluations_st (sous_traitant_id);

create view sous_traitants_notes with (security_invoker = true) as
select s.*, coalesce(e.nb, 0) as nb_evaluations, e.qualite_moy, e.delais_moy, e.prix_moy, e.note_globale
from sous_traitants s
left join lateral (
  select count(*) as nb,
    round(avg(qualite), 1) as qualite_moy,
    round(avg(delais), 1) as delais_moy,
    round(avg(prix), 1) as prix_moy,
    round(avg((qualite + delais + prix) / 3.0), 1) as note_globale
  from evaluations_st where sous_traitant_id = s.id
) e on true;

-- ---------------------------------------------------------------- Matériel et outillage
create type etat_materiel as enum ('bon', 'a_reparer', 'hors_service');

create table materiel (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  reference text,
  etat etat_materiel not null default 'bon',
  chantier_id uuid references chantiers(id) on delete set null,
  detenteur_id uuid references profils(id) on delete set null,
  prochaine_maintenance date,
  notes text,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table materiel_historique (
  id uuid primary key default gen_random_uuid(),
  materiel_id uuid not null references materiel(id) on delete cascade,
  chantier_id uuid references chantiers(id) on delete set null,
  detenteur_id uuid references profils(id) on delete set null,
  created_by uuid references profils(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on materiel_historique (materiel_id, created_at desc);

create table maintenances_materiel (
  id uuid primary key default gen_random_uuid(),
  materiel_id uuid not null references materiel(id) on delete cascade,
  date_maintenance date not null default current_date,
  description text not null,
  cout numeric(14,0) not null default 0 check (cout >= 0),
  created_by uuid references profils(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on maintenances_materiel (materiel_id, date_maintenance desc);

create or replace function public.historiser_materiel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT'
     or new.chantier_id is distinct from old.chantier_id
     or new.detenteur_id is distinct from old.detenteur_id then
    insert into materiel_historique (materiel_id, chantier_id, detenteur_id) values (new.id, new.chantier_id, new.detenteur_id);
  end if;
  return new;
end $$;
create trigger materiel_historique_trg after insert or update on materiel
for each row execute function public.historiser_materiel();

-- ---------------------------------------------------------------- Prospects
create type statut_prospect as enum ('nouveau', 'visite', 'devis_envoye', 'gagne', 'perdu');
create type source_prospect as enum ('bouche_a_oreille', 'facebook', 'whatsapp', 'passage', 'autre');

create table prospects (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  telephone text,
  source source_prospect not null default 'autre',
  demande text,
  statut statut_prospect not null default 'nouveau',
  date_contact date not null default current_date,
  date_visite date,
  montant_estime numeric(14,0) not null default 0 check (montant_estime >= 0),
  raison_perte text,
  client_id uuid references clients(id) on delete set null,
  notes text,
  created_by uuid references profils(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on prospects (statut);

-- Transforme un prospect en client (une seule fois) et le marque « gagné »
create or replace function public.convertir_prospect(p_id uuid)
returns uuid language plpgsql as $$
declare
  p prospects%rowtype;
  nouveau uuid;
begin
  if role_courant() not in ('gerant', 'secretaire') then
    raise exception 'Réservé au gérant et à la secrétaire.';
  end if;
  select * into p from prospects where id = p_id for update;
  if not found then
    raise exception 'Prospect introuvable.';
  end if;
  if p.client_id is not null then
    raise exception 'Ce prospect est déjà devenu client.';
  end if;
  insert into clients (nom, telephone, notes) values (p.nom, p.telephone, p.demande) returning id into nouveau;
  update prospects set client_id = nouveau, statut = 'gagne' where id = p_id;
  return nouveau;
end $$;

-- ---------------------------------------------------------------- Portfolio
create table portfolio (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null unique references chantiers(id) on delete cascade,
  titre text not null,
  description text,
  created_by uuid references profils(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- Espace client (lien de suivi sans compte)
create type statut_choix as enum ('en_attente', 'valide', 'refuse');

create table espaces_client (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null unique references chantiers(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  actif boolean not null default true,
  created_by uuid references profils(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table choix_client (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references chantiers(id) on delete cascade,
  libelle text not null,
  proposition text not null,
  statut statut_choix not null default 'en_attente',
  commentaire_client text,
  repondu_le timestamptz,
  created_by uuid references profils(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on choix_client (chantier_id);

-- Lecture publique, limitée à ce que le client doit voir : avancement et choix à valider.
-- (Ni le détail des rapports, ni les photos, ni les montants.)
create or replace function public.espace_client_lire(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e espaces_client%rowtype;
  ch chantiers%rowtype;
  ent entreprise%rowtype;
begin
  select * into e from espaces_client where token = p_token and actif;
  if not found then
    return null;
  end if;
  select * into ch from chantiers where id = e.chantier_id;
  select * into ent from entreprise where id = 1;
  return jsonb_build_object(
    'entreprise', jsonb_build_object('nom', ent.nom, 'telephone', ent.telephone),
    'chantier', jsonb_build_object('titre', ch.titre, 'statut', ch.statut, 'avancement', ch.avancement_pct,
                                   'date_debut', ch.date_debut, 'date_fin_prevue', ch.date_fin_prevue),
    'historique', coalesce((
      select jsonb_agg(jsonb_build_object('date', date_rapport, 'avancement', avancement_pct) order by date_rapport desc)
      from (select date_rapport, avancement_pct from rapports where chantier_id = ch.id order by date_rapport desc limit 10) r
    ), '[]'::jsonb),
    'choix', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'libelle', libelle, 'proposition', proposition,
                                          'statut', statut, 'commentaire', commentaire_client) order by created_at)
      from choix_client where chantier_id = ch.id
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.espace_client_repondre(p_token text, p_choix uuid, p_statut statut_choix, p_commentaire text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_statut not in ('valide', 'refuse') then
    raise exception 'Réponse invalide.';
  end if;
  update choix_client c
  set statut = p_statut, commentaire_client = left(nullif(trim(p_commentaire), ''), 500), repondu_le = now()
  from espaces_client e
  where c.id = p_choix and e.token = p_token and e.actif and c.chantier_id = e.chantier_id and c.statut = 'en_attente';
  return found;
end $$;

revoke all on function public.espace_client_lire(text) from public;
revoke all on function public.espace_client_repondre(text, uuid, statut_choix, text) from public;
grant execute on function public.espace_client_lire(text) to anon, authenticated;
grant execute on function public.espace_client_repondre(text, uuid, statut_choix, text) to anon, authenticated;

-- ---------------------------------------------------------------- Journal des modifications
create table journal (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text,
  action text not null,
  utilisateur_id uuid,
  changes jsonb,
  created_at timestamptz not null default now()
);
create index on journal (created_at desc);
create index on journal (table_name, record_id);

create or replace function public.journaliser()
returns trigger language plpgsql security definer set search_path = public as $$
declare diff jsonb;
begin
  if tg_op = 'INSERT' then
    insert into journal (table_name, record_id, action, utilisateur_id, changes)
    values (tg_table_name, to_jsonb(new) ->> 'id', 'creation', auth.uid(), to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    -- l'avancement et le stock changent automatiquement (rapports, mouvements) : ils ne sont pas journalisés ici
    select jsonb_object_agg(n.key, jsonb_build_object('avant', o.value, 'apres', n.value)) into diff
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o on o.key = n.key
    where n.value is distinct from o.value and n.key not in ('avancement_pct', 'stock');
    if diff is not null then
      insert into journal (table_name, record_id, action, utilisateur_id, changes)
      values (tg_table_name, to_jsonb(new) ->> 'id', 'modification', auth.uid(), diff);
    end if;
  else
    insert into journal (table_name, record_id, action, utilisateur_id, changes)
    values (tg_table_name, to_jsonb(old) ->> 'id', 'suppression', auth.uid(), to_jsonb(old));
  end if;
  return null;
end $$;

create trigger journal_devis after insert or update or delete on devis for each row execute function public.journaliser();
create trigger journal_factures after insert or update or delete on factures for each row execute function public.journaliser();
create trigger journal_paiements after insert or update or delete on paiements for each row execute function public.journaliser();
create trigger journal_depenses after insert or update or delete on depenses for each row execute function public.journaliser();
create trigger journal_prestations after insert or update or delete on prestations for each row execute function public.journaliser();
create trigger journal_articles after insert or update or delete on articles for each row execute function public.journaliser();
create trigger journal_chantiers after insert or update or delete on chantiers for each row execute function public.journaliser();
create trigger journal_profils after update or delete on profils for each row execute function public.journaliser();
create trigger journal_travailleurs after insert or update or delete on travailleurs for each row execute function public.journaliser();
create trigger journal_avances after insert or update or delete on avances for each row execute function public.journaliser();
create trigger journal_paies after insert or update or delete on paies for each row execute function public.journaliser();

-- ---------------------------------------------------------------- Droits
alter table travailleurs enable row level security;
alter table avances enable row level security;
alter table paies enable row level security;
alter table sous_traitants enable row level security;
alter table evaluations_st enable row level security;
alter table materiel enable row level security;
alter table materiel_historique enable row level security;
alter table maintenances_materiel enable row level security;
alter table prospects enable row level security;
alter table portfolio enable row level security;
alter table espaces_client enable row level security;
alter table choix_client enable row level security;
alter table journal enable row level security;

-- Paie : gérant seulement
create policy travailleurs_gerant on travailleurs for all to authenticated
  using (role_courant() = 'gerant') with check (role_courant() = 'gerant');
create policy avances_gerant on avances for all to authenticated
  using (role_courant() = 'gerant') with check (role_courant() = 'gerant' and created_by = auth.uid());
create policy paies_gerant on paies for all to authenticated
  using (role_courant() = 'gerant') with check (role_courant() = 'gerant');

-- Gérant et secrétaire
create policy sous_traitants_gestion on sous_traitants for all to authenticated
  using (role_courant() in ('gerant', 'secretaire')) with check (role_courant() in ('gerant', 'secretaire'));
create policy evaluations_lecture on evaluations_st for select to authenticated
  using (role_courant() in ('gerant', 'secretaire'));
create policy evaluations_ajout on evaluations_st for insert to authenticated
  with check (role_courant() in ('gerant', 'secretaire') and created_by = auth.uid());
create policy evaluations_suppression on evaluations_st for delete to authenticated
  using (role_courant() = 'gerant');

create policy prospects_gestion on prospects for all to authenticated
  using (role_courant() in ('gerant', 'secretaire')) with check (role_courant() in ('gerant', 'secretaire'));
create policy portfolio_gestion on portfolio for all to authenticated
  using (role_courant() in ('gerant', 'secretaire')) with check (role_courant() in ('gerant', 'secretaire'));
create policy espaces_gestion on espaces_client for all to authenticated
  using (role_courant() in ('gerant', 'secretaire')) with check (role_courant() in ('gerant', 'secretaire'));
create policy choix_gestion on choix_client for all to authenticated
  using (role_courant() in ('gerant', 'secretaire')) with check (role_courant() in ('gerant', 'secretaire'));

-- Matériel : le chef de chantier consulte, le gérant et la secrétaire gèrent
create policy materiel_lecture on materiel for select to authenticated
  using (role_courant() in ('gerant', 'secretaire', 'chef_chantier'));
create policy materiel_ecriture on materiel for insert to authenticated
  with check (role_courant() in ('gerant', 'secretaire'));
create policy materiel_modif on materiel for update to authenticated
  using (role_courant() in ('gerant', 'secretaire')) with check (role_courant() in ('gerant', 'secretaire'));
create policy materiel_hist_lecture on materiel_historique for select to authenticated
  using (role_courant() in ('gerant', 'secretaire', 'chef_chantier'));
create policy maintenances_lecture on maintenances_materiel for select to authenticated
  using (role_courant() in ('gerant', 'secretaire', 'chef_chantier'));
create policy maintenances_ajout on maintenances_materiel for insert to authenticated
  with check (role_courant() in ('gerant', 'secretaire') and created_by = auth.uid());

-- Journal : lecture par le gérant, aucune écriture directe
create policy journal_lecture on journal for select to authenticated
  using (role_courant() = 'gerant');
