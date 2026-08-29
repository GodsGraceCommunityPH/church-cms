/*
  GGCCC Training operational-data reset
  =====================================

  DESTRUCTIVE ADMINISTRATIVE UTILITY — NOT AN AUTOMATIC MIGRATION.

  This file is intentionally ONE PostgreSQL statement. It does not use
  temporary tables and is compatible with Supabase SQL Editor statement
  boundaries.

  DRY RUN (default execution mode):
  1. Change confirmation_text from NOT_CONFIRMED to
     RESET_GGCCC_TRAINING_DATA.
  2. Leave execution_mode as DRY_RUN.
  3. Run this complete file once.
  4. The final deliberate exception rolls back every delete performed inside
     this DO statement. Review its DETAIL plus the NOTICE messages.

  COMMITTED RUN (only after Product Owner approval and backup confirmation):
  1. Use the exact reviewed file.
  2. Keep confirmation_text as RESET_GGCCC_TRAINING_DATA.
  3. Change only execution_mode from DRY_RUN to COMMIT.
  4. Run this complete file once.

  Never use supabase/migrations/001_create_members.sql with this utility.
*/

do $training_reset$
declare
  confirmation_text constant text := 'NOT_CONFIRMED';
  execution_mode constant text := 'DRY_RUN';

  batch_ids uuid[] := '{}'::uuid[];
  enrollment_ids uuid[] := '{}'::uuid[];
  session_ids uuid[] := '{}'::uuid[];

  class_report jsonb := '[]'::jsonb;
  requirement_report jsonb := '[]'::jsonb;
  pre_counts jsonb := '{}'::jsonb;
  post_counts jsonb := '{}'::jsonb;

  members_before bigint;
  cell_groups_before bigint;
  cell_group_memberships_before bigint;
  cell_group_leaders_before bigint;
  training_programs_before bigint;
  requirement_definitions_before bigint;
  public_users_before bigint;
  auth_users_before bigint;

  members_after bigint;
  cell_groups_after bigint;
  cell_group_memberships_after bigint;
  cell_group_leaders_after bigint;
  training_programs_after bigint;
  requirement_definitions_after bigint;
  public_users_after bigint;
  auth_users_after bigint;

  missing_tables text[];
  remaining_operational_rows bigint;
  orphan_rows bigint;
  preserved_changes text[] := '{}'::text[];
begin
  -- Safety guard comes before all data changes.
  if confirmation_text <> 'RESET_GGCCC_TRAINING_DATA' then
    raise exception
      'Training reset NOT confirmed. Set confirmation_text to RESET_GGCCC_TRAINING_DATA.';
  end if;

  if execution_mode not in ('DRY_RUN', 'COMMIT') then
    raise exception 'Invalid execution_mode: %. Use DRY_RUN or COMMIT.', execution_mode;
  end if;

  -- Fail closed if the production database does not match the audited schema.
  select array_agg(required_table order by required_table)
    into missing_tables
  from unnest(array[
    'public.members',
    'public.cell_groups',
    'public.users',
    'auth.users',
    'public.trainings',
    'public.member_trainings',
    'public.training_batches',
    'public.training_sessions',
    'public.training_attendance',
    'public.training_notes',
    'public.training_remedials',
    'public.training_advancement_eligibility',
    'public.member_training_status_history',
    'public.training_completion_checklist',
    'public.training_session_edit_history',
    'public.member_training_workflow_events',
    'public.training_session_schedule_history',
    'public.member_training_guide_assignments',
    'public.training_program_requirements',
    'public.member_training_session_requirement_progress',
    'public.training_session_requirements'
  ]) as required(required_table)
  where to_regclass(required_table) is null;

  if missing_tables is not null then
    raise exception
      'Training reset stopped. Required tables are missing: %',
      array_to_string(missing_tables, ', ');
  end if;

  -- Capture the complete removable scope in variables local to this one atomic
  -- statement. Empty scopes become empty arrays, never NULL.
  select coalesce(array_agg(id order by id), '{}'::uuid[])
    into batch_ids
  from public.training_batches;

  select coalesce(array_agg(id order by id), '{}'::uuid[])
    into enrollment_ids
  from public.member_trainings;

  select coalesce(array_agg(session.id order by session.id), '{}'::uuid[])
    into session_ids
  from public.training_sessions session
  where session.batch_id = any(batch_ids);

  -- Preservation baseline. Cell Group membership is stored on
  -- members.cell_group_id; current leadership is stored on cell_groups.leader_id.
  select count(*) into members_before from public.members;
  select count(*) into cell_groups_before from public.cell_groups;
  select count(*) into cell_group_memberships_before
    from public.members where cell_group_id is not null;
  select count(*) into cell_group_leaders_before
    from public.cell_groups where leader_id is not null;
  select count(*) into training_programs_before from public.trainings;
  select count(*) into requirement_definitions_before
    from public.training_program_requirements;
  select count(*) into public_users_before from public.users;
  select count(*) into auth_users_before from auth.users;

  -- Requirement definitions are reusable program-level configuration and are
  -- preserved. The report requires Product Owner review instead of guessing
  -- which names may have been temporary development entries.
  select coalesce(jsonb_agg(to_jsonb(listed_requirement)
           order by listed_requirement.program_name,
                    listed_requirement.display_order,
                    listed_requirement.requirement_name,
                    listed_requirement.id), '[]'::jsonb)
    into requirement_report
  from (
    select
      requirement.id,
      training.name as program_name,
      requirement.name as requirement_name,
      requirement.display_order,
      requirement.is_active,
      'PRESERVE_BY_DEFAULT_REVIEW_REQUIRED'::text as reset_decision
    from public.training_program_requirements requirement
    join public.trainings training on training.id = requirement.training_id
  ) listed_requirement;

  -- Full class list selected for deletion.
  select coalesce(jsonb_agg(to_jsonb(listed_class)
           order by listed_class.start_date nulls first,
                    listed_class.program_name,
                    listed_class.class_name,
                    listed_class.class_id), '[]'::jsonb)
    into class_report
  from (
    select
      batch.id as class_id,
      training.name as program_name,
      batch.name as class_name,
      batch.status,
      batch.starts_on as start_date,
      batch.ends_on as end_date,
      count(distinct enrollment.id) as enrollment_count,
      count(distinct session.id) as session_count
    from public.training_batches batch
    join public.trainings training on training.id = batch.training_id
    left join public.member_trainings enrollment on enrollment.batch_id = batch.id
    left join public.training_sessions session on session.batch_id = batch.id
    where batch.id = any(batch_ids)
    group by batch.id, training.name, batch.name, batch.status,
             batch.starts_on, batch.ends_on
  ) listed_class;

  pre_counts := jsonb_build_object(
    'training_programs_preserved', training_programs_before,
    'requirement_definitions_preserved', requirement_definitions_before,
    'classes_batches', cardinality(batch_ids),
    'enrollments', cardinality(enrollment_ids),
    'unique_affected_members', (
      select count(distinct member_id)
      from public.member_trainings where id = any(enrollment_ids)
    ),
    'sessions', cardinality(session_ids),
    'attendance', (
      select count(*) from public.training_attendance
      where member_training_id = any(enrollment_ids) or session_id = any(session_ids)
    ),
    'session_requirement_assignments', (
      select count(*) from public.training_session_requirements
      where training_session_id = any(session_ids)
    ),
    'requirement_progress', (
      select count(*) from public.member_training_session_requirement_progress
      where member_training_id = any(enrollment_ids)
         or training_session_id = any(session_ids)
    ),
    'guide_assignment_rows', (
      select count(*) from public.member_training_guide_assignments
      where member_training_id = any(enrollment_ids)
    ),
    'current_guide_assignments', (
      select count(*) from public.member_training_guide_assignments
      where member_training_id = any(enrollment_ids) and ended_at is null
    ),
    'guide_assignment_history', (
      select count(*) from public.member_training_guide_assignments
      where member_training_id = any(enrollment_ids) and ended_at is not null
    ),
    'remedials', (
      select count(*) from public.training_remedials
      where member_training_id = any(enrollment_ids) or session_id = any(session_ids)
    ),
    'trainer_notes', (
      select count(*) from public.training_notes
      where member_training_id = any(enrollment_ids)
    ),
    'completed_enrollments', (
      select count(*) from public.member_trainings
      where id = any(enrollment_ids) and workflow_status = 'completed'
    ),
    'completion_checklist_rows', (
      select count(*) from public.training_completion_checklist
      where batch_id = any(batch_ids)
    ),
    'advancement_records', (
      select count(*) from public.training_advancement_eligibility
      where source_member_training_id = any(enrollment_ids)
    ),
    'status_history', (
      select count(*) from public.member_training_status_history
      where member_training_id = any(enrollment_ids)
    ),
    'workflow_events', (
      select count(*) from public.member_training_workflow_events
      where member_training_id = any(enrollment_ids)
    ),
    'completed_session_corrections', (
      select count(*) from public.member_training_workflow_events
      where member_training_id = any(enrollment_ids)
        and event_type = 'student_record_corrected'
    ),
    'session_edit_history', (
      select count(*) from public.training_session_edit_history
      where session_id = any(session_ids)
    ),
    'session_schedule_history', (
      select count(*) from public.training_session_schedule_history
      where session_id = any(session_ids)
    )
  );

  raise notice 'GGCCC TRAINING RESET MODE: %', execution_mode;
  raise notice 'PRESERVED TRAINING PROGRAMS: %',
    (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name)
             order by name, id), '[]'::jsonb) from public.trainings);
  raise notice 'REQUIREMENT DEFINITIONS (PRESERVED): %', requirement_report;
  raise notice 'CLASSES SELECTED FOR DELETION: %', class_report;
  raise notice 'PRE-RESET COUNTS: %', pre_counts;
  raise notice 'PRESERVED BASELINE: %', jsonb_build_object(
    'members', members_before,
    'cell_groups', cell_groups_before,
    'cell_group_memberships', cell_group_memberships_before,
    'cell_group_leaders', cell_group_leaders_before,
    'training_programs', training_programs_before,
    'training_requirement_definitions', requirement_definitions_before,
    'public_user_profiles', public_users_before,
    'auth_users', auth_users_before
  );

  -- -------------------------------------------------------------------------
  -- DEPENDENCY-SAFE DELETION
  -- -------------------------------------------------------------------------

  -- Progress first: migration 031 may block removing an assignment while its
  -- student progress still exists.
  delete from public.member_training_session_requirement_progress
  where member_training_id = any(enrollment_ids)
     or training_session_id = any(session_ids);

  -- Training-specific workflow events contain completed-session corrections.
  -- No shared cross-module audit table is touched.
  delete from public.member_training_workflow_events
  where member_training_id = any(enrollment_ids);

  delete from public.member_training_status_history
  where member_training_id = any(enrollment_ids);

  delete from public.training_session_schedule_history
  where session_id = any(session_ids);

  delete from public.training_session_edit_history
  where session_id = any(session_ids);

  delete from public.training_attendance
  where member_training_id = any(enrollment_ids)
     or session_id = any(session_ids);

  delete from public.training_remedials
  where member_training_id = any(enrollment_ids)
     or session_id = any(session_ids);

  delete from public.training_notes
  where member_training_id = any(enrollment_ids);

  -- Current Guide assignment and Guide reassignment history share this table.
  delete from public.member_training_guide_assignments
  where member_training_id = any(enrollment_ids);

  delete from public.training_advancement_eligibility
  where source_member_training_id = any(enrollment_ids);

  delete from public.training_session_requirements
  where training_session_id = any(session_ids);

  delete from public.training_completion_checklist
  where batch_id = any(batch_ids);

  delete from public.training_sessions
  where id = any(session_ids);

  -- Enrollment-specific dates, status, Cell Group/leader snapshots, and Guide
  -- relationships are removed here without modifying members or cell_groups.
  delete from public.member_trainings
  where id = any(enrollment_ids);

  delete from public.training_batches
  where id = any(batch_ids);

  -- -------------------------------------------------------------------------
  -- POST-DELETE VERIFICATION, STILL INSIDE THIS ONE ATOMIC STATEMENT
  -- -------------------------------------------------------------------------

  post_counts := jsonb_build_object(
    'classes_batches', (select count(*) from public.training_batches),
    'enrollments', (select count(*) from public.member_trainings),
    'sessions', (select count(*) from public.training_sessions),
    'attendance', (select count(*) from public.training_attendance),
    'session_requirement_assignments', (select count(*) from public.training_session_requirements),
    'requirement_progress', (select count(*) from public.member_training_session_requirement_progress),
    'guide_assignment_rows', (select count(*) from public.member_training_guide_assignments),
    'remedials', (select count(*) from public.training_remedials),
    'trainer_notes', (select count(*) from public.training_notes),
    'completion_checklist_rows', (select count(*) from public.training_completion_checklist),
    'advancement_records', (select count(*) from public.training_advancement_eligibility),
    'status_history', (select count(*) from public.member_training_status_history),
    'workflow_events', (select count(*) from public.member_training_workflow_events),
    'completed_session_corrections', (
      select count(*) from public.member_training_workflow_events
      where event_type = 'student_record_corrected'
    ),
    'session_edit_history', (select count(*) from public.training_session_edit_history),
    'session_schedule_history', (select count(*) from public.training_session_schedule_history)
  );

  select
      (select count(*) from public.training_batches)
    + (select count(*) from public.member_trainings)
    + (select count(*) from public.training_sessions)
    + (select count(*) from public.training_attendance)
    + (select count(*) from public.training_notes)
    + (select count(*) from public.training_remedials)
    + (select count(*) from public.training_advancement_eligibility)
    + (select count(*) from public.member_training_status_history)
    + (select count(*) from public.training_completion_checklist)
    + (select count(*) from public.training_session_edit_history)
    + (select count(*) from public.member_training_workflow_events)
    + (select count(*) from public.training_session_schedule_history)
    + (select count(*) from public.member_training_guide_assignments)
    + (select count(*) from public.member_training_session_requirement_progress)
    + (select count(*) from public.training_session_requirements)
    into remaining_operational_rows;

  if remaining_operational_rows <> 0 then
    raise exception
      'Training reset verification failed: % operational rows remain.',
      remaining_operational_rows;
  end if;

  -- Preservation comparison.
  select count(*) into members_after from public.members;
  select count(*) into cell_groups_after from public.cell_groups;
  select count(*) into cell_group_memberships_after
    from public.members where cell_group_id is not null;
  select count(*) into cell_group_leaders_after
    from public.cell_groups where leader_id is not null;
  select count(*) into training_programs_after from public.trainings;
  select count(*) into requirement_definitions_after
    from public.training_program_requirements;
  select count(*) into public_users_after from public.users;
  select count(*) into auth_users_after from auth.users;

  if members_after <> members_before then preserved_changes := array_append(preserved_changes, 'members'); end if;
  if cell_groups_after <> cell_groups_before then preserved_changes := array_append(preserved_changes, 'cell_groups'); end if;
  if cell_group_memberships_after <> cell_group_memberships_before then preserved_changes := array_append(preserved_changes, 'cell_group_memberships'); end if;
  if cell_group_leaders_after <> cell_group_leaders_before then preserved_changes := array_append(preserved_changes, 'cell_group_leaders'); end if;
  if training_programs_after <> training_programs_before then preserved_changes := array_append(preserved_changes, 'training_programs'); end if;
  if requirement_definitions_after <> requirement_definitions_before then preserved_changes := array_append(preserved_changes, 'training_requirement_definitions'); end if;
  if public_users_after <> public_users_before then preserved_changes := array_append(preserved_changes, 'public_user_profiles'); end if;
  if auth_users_after <> auth_users_before then preserved_changes := array_append(preserved_changes, 'auth_users'); end if;

  if cardinality(preserved_changes) <> 0 then
    raise exception
      'Training reset changed preserved records: %',
      array_to_string(preserved_changes, ', ');
  end if;

  -- Orphan verification. Every count must remain zero.
  select sum(orphan_count) into orphan_rows
  from (
    select count(*)::bigint as orphan_count
    from public.training_attendance attendance
    left join public.member_trainings enrollment on enrollment.id = attendance.member_training_id
    left join public.training_sessions session on session.id = attendance.session_id
    where enrollment.id is null or session.id is null
    union all
    select count(*)
    from public.training_remedials remedial
    left join public.member_trainings enrollment on enrollment.id = remedial.member_training_id
    left join public.training_sessions session on session.id = remedial.session_id
    where enrollment.id is null
       or (remedial.session_id is not null and session.id is null)
    union all
    select count(*)
    from public.member_training_session_requirement_progress progress
    left join public.member_trainings enrollment on enrollment.id = progress.member_training_id
    left join public.training_sessions session on session.id = progress.training_session_id
    left join public.training_program_requirements requirement on requirement.id = progress.program_requirement_id
    where enrollment.id is null or session.id is null or requirement.id is null
    union all
    select count(*)
    from public.training_session_requirements assignment
    left join public.training_sessions session on session.id = assignment.training_session_id
    left join public.training_program_requirements requirement on requirement.id = assignment.program_requirement_id
    where session.id is null or requirement.id is null
    union all
    select count(*)
    from public.member_training_guide_assignments guide
    left join public.member_trainings enrollment on enrollment.id = guide.member_training_id
    left join public.members member on member.id = guide.guide_member_id
    where enrollment.id is null or member.id is null
  ) orphan_checks;

  if orphan_rows <> 0 then
    raise exception 'Training reset orphan verification failed: % orphan rows.', orphan_rows;
  end if;

  raise notice 'POST-DELETE COUNTS: %', post_counts;
  raise notice 'PRESERVED COUNTS VERIFIED UNCHANGED: %', jsonb_build_object(
    'members', members_after,
    'cell_groups', cell_groups_after,
    'cell_group_memberships', cell_group_memberships_after,
    'cell_group_leaders', cell_group_leaders_after,
    'training_programs', training_programs_after,
    'training_requirement_definitions', requirement_definitions_after,
    'public_user_profiles', public_users_after,
    'auth_users', auth_users_after
  );
  raise notice 'ORPHAN ROWS: %', orphan_rows;

  if execution_mode = 'DRY_RUN' then
    -- Raising an exception rolls back this entire DO statement even when the
    -- SQL Editor auto-commits statements. This is the Supabase-compatible dry-
    -- run equivalent of ending a multi-statement transaction with ROLLBACK.
    raise exception using
      message = 'DRY RUN COMPLETE — ALL TRAINING RESET CHANGES WERE ROLLED BACK',
      detail = jsonb_build_object(
        'pre_reset_counts', pre_counts,
        'classes_selected_for_deletion', class_report,
        'requirement_definitions_preserved', requirement_report,
        'post_delete_counts_before_rollback', post_counts,
        'orphan_rows', orphan_rows
      )::text,
      hint = 'Review the report. The database was not changed. Product Owner approval is required before changing execution_mode to COMMIT.';
  end if;

  raise notice 'COMMITTED RESET COMPLETE. Record operator, timestamp, script version, and reports now.';
end;
$training_reset$;
