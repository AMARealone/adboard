-- ============================================================================
-- SÉCURITÉ SUPABASE — AdStack CRM
-- À exécuter dans Supabase > SQL Editor, ÉTAPE PAR ÉTAPE (pas tout d'un coup).
-- ⚠️ Ce script n'a PAS été exécuté ni testé sur votre base : je n'y ai pas accès.
--    Il est écrit pour être sans risque tant que vous ne lancez pas l'ÉTAPE 3.
-- Principe : seul l'administrateur (thefirstquality01@gmail.com, connecté) peut lire/écrire
-- les tables du CRM. Le serveur (clé service_role) et les scripts qui l'utilisent ne sont pas concernés par RLS.
-- Hors périmètre volontairement : products, briefs, subscriptions, notifications, transactions (AdBoard / utilisateurs).
-- ============================================================================

-- ─── ÉTAPE 0 — Voir ce qui existe aujourd'hui (lecture seule) ───────────────
-- Notez les lignes où roles contient {anon} ou {public} : ce sont les accès ouverts à tous.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('prospects','short_links','funnel_events','clarity_snapshots','data_insights','chat_messages','email_sequence_log','email_events','api_usage_log','transactions')
order by tablename, policyname;

-- ─── ÉTAPE 1 — Ajouter l'accès administrateur (sans rien retirer : sans danger) ──
do $$
declare t text;
begin
  foreach t in array array['prospects','short_links','funnel_events','clarity_snapshots','data_insights','chat_messages','email_sequence_log','email_events','api_usage_log','transactions']
  loop
    if to_regclass('public.'||t) is not null then
      execute format('drop policy if exists admin_tout on public.%I', t);
      execute format($p$create policy admin_tout on public.%I for all to authenticated
        using ((auth.jwt() ->> 'email') = 'thefirstquality01@gmail.com')
        with check ((auth.jwt() ->> 'email') = 'thefirstquality01@gmail.com')$p$, t);
    end if;
  end loop;
end $$;

-- ─── ÉTAPE 2 — VÉRIFIER AVANT DE CONTINUER ──────────────────────────────────
--  a) Le nouveau CRM (/crm-next) fonctionne connecté : prospects, dashboard, emails, comportement s'affichent.
--  b) Le serveur Render a bien été redéployé avec serveur.js (la page de réservation vente.html passe par /reserver-appel).
--  c) Vos scripts sur le PC (maj_ads_j10.py, prospecteur) : ouvrez-les et cherchez la clé utilisée.
--     - clé « service_role »  → rien à faire.
--     - clé « anon » (commence par eyJ… et contient "anon") → remplacez-la par la clé service_role
--       (Supabase > Project Settings > API) AVANT l'étape 3, sinon ils n'auront plus accès à la table prospects.
--  d) Les tests ci-dessus sont à faire, puis seulement ensuite l'étape 3.

-- ─── ÉTAPE 3 — Fermer l'accès public (c'est ici que ça coupe l'accès anonyme) ──
-- Active RLS et supprime TOUTES les règles ouvertes à « anon »/« public » sur les tables du CRM.
-- (Les règles réservées aux utilisateurs connectés ne sont pas touchées. transactions n'est pas modifiée.)
do $$
declare t text; pol record;
begin
  foreach t in array array['prospects','short_links','funnel_events','clarity_snapshots','data_insights','chat_messages','email_sequence_log','email_events','api_usage_log']
  loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security', t);
      for pol in select policyname from pg_policies where schemaname='public' and tablename=t and (roles @> '{anon}' or roles @> '{public}')
      loop
        execute format('drop policy %I on public.%I', pol.policyname, t);
      end loop;
    end if;
  end loop;
end $$;

-- Test rapide : doit renvoyer 0 ligne (ou une erreur de permission) avec la clé anon, depuis un navigateur non connecté :
--   https://mifljhsusidgzelnswma.supabase.co/rest/v1/prospects?select=id&limit=1   (en-tête apikey = clé anon)

-- ─── ANNULER (si quelque chose casse après l'étape 3) ───────────────────────
-- Réouvre la lecture/écriture publique d'une table (exemple pour prospects) — à utiliser en dépannage uniquement :
--   create policy ouvert_temporaire on public.prospects for all to anon, authenticated using (true) with check (true);
-- Puis dites-moi quel script a cassé pour qu'on corrige proprement.
