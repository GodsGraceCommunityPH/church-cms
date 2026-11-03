begin;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.users(id) on delete cascade,
  event_type text not null check (event_type in ('new_member_registered', 'member_profile_updated', 'member_archived', 'member_removed')),
  title text not null,
  message text not null,
  related_member_id uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_recipient_created_idx
  on public.notifications(recipient_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications(recipient_id, created_at desc) where read_at is null;

create table if not exists public.member_admin_views (
  member_id uuid not null references public.members(id) on delete cascade,
  admin_id uuid not null references public.users(id) on delete cascade,
  viewed_at timestamptz,
  primary key (member_id, admin_id)
);

alter table public.notifications enable row level security;
alter table public.member_admin_views enable row level security;
revoke all on public.notifications, public.member_admin_views from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select on public.member_admin_views to authenticated;
grant update (viewed_at) on public.member_admin_views to authenticated;

drop policy if exists "Member viewers read own notifications" on public.notifications;
create policy "Member viewers read own notifications" on public.notifications
for select to authenticated using (
  recipient_id = auth.uid() and public.has_permission('members.view')
);
drop policy if exists "Member viewers mark own notifications read" on public.notifications;
create policy "Member viewers mark own notifications read" on public.notifications
for update to authenticated using (
  recipient_id = auth.uid() and public.has_permission('members.view')
) with check (
  recipient_id = auth.uid() and public.has_permission('members.view')
);

drop policy if exists "Member viewers read own member view status" on public.member_admin_views;
create policy "Member viewers read own member view status" on public.member_admin_views
for select to authenticated using (
  admin_id = auth.uid() and public.has_permission('members.view')
);
drop policy if exists "Member viewers update own member view status" on public.member_admin_views;
create policy "Member viewers update own member view status" on public.member_admin_views
for update to authenticated using (
  admin_id = auth.uid() and public.has_permission('members.view')
) with check (
  admin_id = auth.uid() and public.has_permission('members.view') and viewed_at is not null
);

create or replace function public.notify_member_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipients uuid[];
  group_name text;
  recipient uuid;
  kind text;
  notification_title text;
  notification_message text;
  display_name text;
begin
  if tg_op = 'DELETE' then
    display_name := concat_ws(' ', old.first_name, old.last_name);
    select array_agg(u.id) into recipients from public.users u
    where u.is_active and exists (
      select 1 from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions p on p.id = rp.permission_id
      where ur.user_id = u.id and p.code = 'members.view'
    );
    if recipients is not null then
      foreach recipient in array recipients loop
        insert into public.notifications(recipient_id,event_type,title,message)
        values (recipient,'member_removed','Member Removed',display_name || ' was permanently removed.');
      end loop;
    end if;
    return old;
  end if;

  display_name := concat_ws(' ', new.first_name, new.last_name);

  if tg_op = 'INSERT' then
    if current_setting('ggccc.member_invite_registration', true) is distinct from 'on' then
      return new;
    end if;
    kind := 'new_member_registered';
    notification_title := 'New Member Joined';
    select cg.name into group_name from public.cell_groups cg where cg.id = new.cell_group_id;
    notification_message := display_name || ' joined ' || coalesce(group_name, 'a Cell Group') || '.';
  else
    if (to_jsonb(new) - 'updated_at') is not distinct from (to_jsonb(old) - 'updated_at') then
      return new;
    end if;
    if coalesce(new.membership_status, '') <> coalesce(old.membership_status, '')
       and lower(coalesce(new.membership_status, '')) in ('inactive', 'archived') then
      kind := 'member_archived';
      notification_title := 'Member Archived';
      notification_message := display_name || ' was archived or deactivated.';
    else
      kind := 'member_profile_updated';
      notification_title := 'Member Profile Updated';
      notification_message := display_name || '''s profile was updated.';
    end if;
  end if;

  select array_agg(u.id) into recipients from public.users u
  where u.is_active and exists (
    select 1 from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = u.id and p.code = 'members.view'
  );
  if recipients is not null then
    foreach recipient in array recipients loop
      insert into public.notifications(recipient_id,event_type,title,message,related_member_id)
      values (recipient,kind,notification_title,notification_message,new.id);
      if tg_op = 'INSERT' then
        insert into public.member_admin_views(member_id,admin_id)
        values (new.id,recipient) on conflict (member_id,admin_id) do nothing;
      end if;
    end loop;
  end if;
  return new;
end;
$$;

revoke all on function public.notify_member_change() from public, anon, authenticated;

drop trigger if exists member_notifications_after_insert on public.members;
drop trigger if exists member_notifications_after_update on public.members;
drop trigger if exists member_notifications_after_delete on public.members;
create trigger member_notifications_after_insert after insert on public.members
for each row execute function public.notify_member_change();
create trigger member_notifications_after_update after update on public.members
for each row execute function public.notify_member_change();
create trigger member_notifications_after_delete after delete on public.members
for each row execute function public.notify_member_change();

-- Mark only the public invite RPC's insert as a registration. This avoids
-- treating ordinary staff-created records as Cell Group invite registrations.
create or replace function public.submit_cell_group_member_registration(
  p_request_id uuid,
  p_invite_token text,
  p_first_name text,
  p_last_name text,
  p_nickname text,
  p_gender text,
  p_birthday date,
  p_mobile text,
  p_email text,
  p_address text,
  p_match_decision text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_cell_group_id uuid;
  normalized_first text := public.normalize_member_registration_name(p_first_name);
  normalized_last text := public.normalize_member_registration_name(p_last_name);
  clean_first text := regexp_replace(btrim(coalesce(p_first_name, '')), '[[:space:]]+', ' ', 'g');
  clean_last text := regexp_replace(btrim(coalesce(p_last_name, '')), '[[:space:]]+', ' ', 'g');
  match_count integer;
  matched_member public.members%rowtype;
begin
  if p_request_id is null then raise exception 'A registration request identifier is required' using errcode = '22023'; end if;
  if normalized_first = '' or normalized_last = '' then raise exception 'First name and last name are required' using errcode = '22023'; end if;
  if p_gender not in ('Male', 'Female') then raise exception 'A valid gender is required' using errcode = '22023'; end if;
  if p_birthday is not null and p_birthday >= current_date then raise exception 'Birthday must be earlier than today' using errcode = '22023'; end if;
  if p_match_decision is not null and p_match_decision not in ('confirm_existing', 'create_new') then raise exception 'Invalid profile matching decision' using errcode = '22023'; end if;

  select invite.cell_group_id into target_cell_group_id
  from public.cell_group_invites invite
  where invite.token = p_invite_token and invite.is_active = true limit 1;
  if target_cell_group_id is null then raise exception 'This invitation is invalid or inactive' using errcode = 'P0002'; end if;

  perform pg_advisory_xact_lock(hashtextextended(normalized_first || chr(31) || normalized_last, 0));
  select count(*) into match_count from public.members member
  where public.normalize_member_registration_name(member.first_name) = normalized_first
    and public.normalize_member_registration_name(member.last_name) = normalized_last;

  if match_count > 1 then
    insert into public.member_registration_reviews (
      request_id, cell_group_id, normalized_first_name, normalized_last_name, submitted_profile, matched_profile_count
    ) values (
      p_request_id, target_cell_group_id, normalized_first, normalized_last,
      jsonb_build_object('first_name',clean_first,'last_name',clean_last,
        'nickname',nullif(btrim(coalesce(p_nickname,'')),''),'gender',nullif(btrim(coalesce(p_gender,'')),''),
        'birthday',p_birthday,'mobile',nullif(btrim(coalesce(p_mobile,'')),''),
        'email',nullif(btrim(coalesce(p_email,'')),''),'address',nullif(btrim(coalesce(p_address,'')),'')),
      match_count
    ) on conflict (request_id) do nothing;
    return jsonb_build_object('status','needs_review');
  end if;

  if match_count = 1 and p_match_decision is null then
    select member.* into matched_member from public.members member
    where public.normalize_member_registration_name(member.first_name) = normalized_first
      and public.normalize_member_registration_name(member.last_name) = normalized_last limit 1;
    return jsonb_build_object('status','needs_confirmation','display_name',concat_ws(' ',matched_member.first_name,matched_member.last_name));
  end if;

  if match_count = 1 and p_match_decision = 'confirm_existing' then
    select member.* into matched_member from public.members member
    where public.normalize_member_registration_name(member.first_name) = normalized_first
      and public.normalize_member_registration_name(member.last_name) = normalized_last limit 1 for update;
    update public.members set first_name=clean_first,last_name=clean_last,
      nickname=coalesce(nullif(btrim(coalesce(p_nickname,'')),''),matched_member.nickname),
      gender=coalesce(nullif(btrim(coalesce(p_gender,'')),''),matched_member.gender),
      birthday=coalesce(p_birthday,matched_member.birthday),
      mobile=coalesce(nullif(btrim(coalesce(p_mobile,'')),''),matched_member.mobile),
      email=coalesce(nullif(btrim(coalesce(p_email,'')),''),matched_member.email),
      address=coalesce(nullif(btrim(coalesce(p_address,'')),''),matched_member.address),
      cell_group_id=coalesce(matched_member.cell_group_id,target_cell_group_id)
    where id=matched_member.id;
    return jsonb_build_object('status','updated');
  end if;

  if match_count = 1 and p_match_decision = 'create_new' then null;
  elsif match_count = 0 and p_match_decision = 'confirm_existing' then
    raise exception 'The existing profile is no longer available for confirmation' using errcode = 'P0002';
  end if;

  perform set_config('ggccc.member_invite_registration','on',true);
  insert into public.members(first_name,last_name,nickname,gender,birthday,mobile,email,address,cell_group_id,membership_status,remarks)
  values (clean_first,clean_last,coalesce(nullif(btrim(coalesce(p_nickname,'')),''),''),p_gender,p_birthday,
    coalesce(nullif(btrim(coalesce(p_mobile,'')),''),''),coalesce(nullif(btrim(coalesce(p_email,'')),''),''),
    coalesce(nullif(btrim(coalesce(p_address,'')),''),''),target_cell_group_id,'Visitor','');
  return jsonb_build_object('status','created');
end;
$$;

revoke all on function public.submit_cell_group_member_registration(uuid,text,text,text,text,text,date,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_cell_group_member_registration(uuid,text,text,text,text,text,date,text,text,text,text) to anon, authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception when duplicate_object then null;
end $$;

commit;
