-- SUYNL member roster import utility
--
-- Run this entire script as one selection. The roster, pre-insert snapshot,
-- insert, and reports are deliberately contained in one SQL statement so they
-- do not depend on session-persistent temporary tables.
--
-- The live public.members table has no duplicate constraint, name index,
-- duplicate trigger, or member-creation RPC. This utility skips only rows whose
-- stored first_name and last_name exactly equal the roster values. It performs
-- no case folding, whitespace normalization, fuzzy matching, merging, or update.
--
-- The live column is public.members.gender. Existing stored values establish
-- the project convention as 'Male' and 'Female'.
--
-- After Product Owner approval, change ONLY the final ROLLBACK to COMMIT.

begin;

with
roster (roster_order, full_name, first_name, last_name, gender) as (
  values
    (1,  'Chriszian Emmanuel G. Guevarra', 'Chriszian Emmanuel G.', 'Guevarra', 'Male'),
    (2,  'Reign Cedric Aaron V. Santos', 'Reign Cedric Aaron V.', 'Santos', 'Male'),
    (3,  'Carlito Zceya S. Fernandez', 'Carlito Zceya S.', 'Fernandez', 'Male'),
    (4,  'Jerome C. Gonzales', 'Jerome C.', 'Gonzales', 'Male'),
    (5,  'Job Daniel Z. Lee', 'Job Daniel Z.', 'Lee', 'Male'),
    (6,  'John Kenneth Basan', 'John Kenneth', 'Basan', 'Male'),
    (7,  'Arnold Lipata', 'Arnold', 'Lipata', 'Male'),
    (8,  'Mark Penoliar', 'Mark', 'Penoliar', 'Male'),
    (9,  'Lord Karsten F. Chua', 'Lord Karsten F.', 'Chua', 'Male'),
    (10, 'John Dave Dela Cruz', 'John Dave Dela', 'Cruz', 'Male'),
    (11, 'Jonas Oliva', 'Jonas', 'Oliva', 'Male'),
    (12, 'Alden Kiefer N. Aquino', 'Alden Kiefer N.', 'Aquino', 'Male'),
    (13, 'Cesar A. Bucio', 'Cesar A.', 'Bucio', 'Male'),
    (14, 'James Bert T. Miralles', 'James Bert T.', 'Miralles', 'Male'),
    (15, 'Christian Jharen Fullente', 'Christian Jharen', 'Fullente', 'Male'),
    (16, 'Caleb Austine J. Avengoza', 'Caleb Austine J.', 'Avengoza', 'Male'),
    (17, 'Denver D. Alapad', 'Denver D.', 'Alapad', 'Male'),
    (18, 'Saimon Riel Chan', 'Saimon Riel', 'Chan', 'Male'),
    (19, 'Eddie Jr. C. Diaz', 'Eddie Jr. C.', 'Diaz', 'Male'),
    (20, 'Dirk Aeon B. Bakila', 'Dirk Aeon B.', 'Bakila', 'Male'),
    (21, 'Jojie F. Mejica', 'Jojie F.', 'Mejica', 'Male'),
    (22, 'Stephen U. Sucatan', 'Stephen U.', 'Sucatan', 'Male'),
    (23, 'Ralph Basbas', 'Ralph', 'Basbas', 'Male'),
    (24, 'Princess Kean Gel R. Pedro', 'Princess Kean Gel R.', 'Pedro', 'Female'),
    (25, 'Angelika Mae R. Pedro', 'Angelika Mae R.', 'Pedro', 'Female'),
    (26, 'Keisha Venice E. Apan', 'Keisha Venice E.', 'Apan', 'Female'),
    (27, 'Janelle C. Calderon', 'Janelle C.', 'Calderon', 'Female'),
    (28, 'Ma Angela F. Fernando', 'Ma Angela F.', 'Fernando', 'Female'),
    (29, 'Crystal Joy Balasta', 'Crystal Joy', 'Balasta', 'Female'),
    (30, 'Princess Jed Benavidez', 'Princess Jed', 'Benavidez', 'Female'),
    (31, 'Christine Julia L. Dialino', 'Christine Julia L.', 'Dialino', 'Female'),
    (32, 'Jullian M. Lepit', 'Jullian M.', 'Lepit', 'Female'),
    (33, 'Hanna B. Kim', 'Hanna B.', 'Kim', 'Female'),
    (34, 'Neselie D. Manalili', 'Neselie D.', 'Manalili', 'Female'),
    (35, 'Marjorie S. Mina', 'Marjorie S.', 'Mina', 'Female'),
    (36, 'Ayhana Casandra J. Avengoza', 'Ayhana Casandra J.', 'Avengoza', 'Female'),
    (37, 'Aleah Anne Antonio', 'Aleah Anne', 'Antonio', 'Female'),
    (38, 'Angelica T. Gucela', 'Angelica T.', 'Gucela', 'Female'),
    (39, 'Charlene Athlea N. Tamares', 'Charlene Athlea N.', 'Tamares', 'Female'),
    (40, 'Althea Nicole Suarez', 'Althea Nicole', 'Suarez', 'Female')
),
existing as materialized (
  select
    roster.roster_order,
    array_agg(member.id order by member.id) as existing_member_ids,
    array_agg(member.gender order by member.id) as existing_genders
  from roster
  join public.members member
    on member.first_name = roster.first_name
   and member.last_name = roster.last_name
  group by roster.roster_order
),
inserted as (
  insert into public.members (first_name, last_name, gender)
  select roster.first_name, roster.last_name, roster.gender
  from roster
  where not exists (
    select 1
    from existing
    where existing.roster_order = roster.roster_order
  )
  order by roster.roster_order
  returning id, first_name, last_name, gender
),
outcomes as (
  select
    roster.roster_order,
    roster.full_name,
    roster.gender as roster_gender,
    existing.existing_member_ids,
    existing.existing_genders,
    inserted.id as inserted_member_id,
    inserted.gender as inserted_gender,
    case
      when inserted.id is not null then 'Inserted'
      else 'Pre-existing / skipped'
    end as outcome
  from roster
  left join existing
    on existing.roster_order = roster.roster_order
  left join inserted
    on inserted.first_name = roster.first_name
   and inserted.last_name = roster.last_name
   and inserted.gender = roster.gender
)
select
  roster_order,
  full_name,
  roster_gender,
  outcome,
  existing_member_ids,
  existing_genders,
  inserted_member_id,
  inserted_gender,
  count(*) over () as roster_count,
  count(*) filter (where inserted_member_id is not null) over () as inserted_count,
  count(*) filter (where inserted_member_id is null) over () as skipped_count,
  count(*) filter (
    where inserted_member_id is not null or existing_member_ids is not null
  ) over () as represented_after_insert
from outcomes
order by roster_order;

-- SAFETY DEFAULT: review the result above. After Product Owner approval,
-- change ONLY this final ROLLBACK to COMMIT.
rollback;
