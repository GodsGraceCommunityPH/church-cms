begin;

create table if not exists public.member_registration_reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  cell_group_id uuid not null references public.cell_groups(id) on delete restrict,
  normalized_first_name text not null,
  normalized_last_name text not null,
  submitted_profile jsonb not null,
  matched_profile_count integer not null check (matched_profile_count > 1),
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.member_registration_reviews enable row level security;
revoke all on public.member_registration_reviews from public, anon, authenticated;
grant select, update on public.member_registration_reviews to authenticated;

drop policy if exists "Permitted member registration review read" on public.member_registration_reviews;
create policy "Permitted member registration review read"
on public.member_registration_reviews for select to authenticated
using (public.has_permission('members.view'));

drop policy if exists "Permitted member registration review update" on public.member_registration_reviews;
create policy "Permitted member registration review update"
on public.member_registration_reviews for update to authenticated
using (public.has_permission('members.update'))
with check (public.has_permission('members.update'));

create or replace function public.normalize_member_registration_name(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(btrim(coalesce(p_value, '')), '[[:space:]]+', ' ', 'g'));
$$;

create index if not exists members_registration_normalized_name_idx
on public.members (
  public.normalize_member_registration_name(first_name),
  public.normalize_member_registration_name(last_name)
);

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
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_cell_group_id uuid;
  normalized_first text := public.normalize_member_registration_name(p_first_name);
  normalized_last text := public.normalize_member_registration_name(p_last_name);
  clean_first text := regexp_replace(btrim(coalesce(p_first_name, '')), '[[:space:]]+', ' ', 'g');
  clean_last text := regexp_replace(btrim(coalesce(p_last_name, '')), '[[:space:]]+', ' ', 'g');
  match_count integer;
  matched_member public.members%rowtype;
begin
  if p_request_id is null then
    raise exception 'A registration request identifier is required' using errcode = '22023';
  end if;
  if normalized_first = '' or normalized_last = '' then
    raise exception 'First name and last name are required' using errcode = '22023';
  end if;
  if p_gender not in ('Male', 'Female') then
    raise exception 'A valid gender is required' using errcode = '22023';
  end if;
  if p_birthday is null or p_birthday >= current_date then
    raise exception 'Birthday must be earlier than today' using errcode = '22023';
  end if;
  if p_match_decision is not null and p_match_decision not in ('confirm_existing', 'create_new') then
    raise exception 'Invalid profile matching decision' using errcode = '22023';
  end if;

  select invite.cell_group_id
  into target_cell_group_id
  from public.cell_group_invites invite
  where invite.token = p_invite_token
    and invite.is_active = true
  limit 1;

  if target_cell_group_id is null then
    raise exception 'This invitation is invalid or inactive' using errcode = 'P0002';
  end if;

  -- Serialize public submissions for the same normalized name. Names remain
  -- non-unique because distinct people are allowed to share them.
  perform pg_advisory_xact_lock(hashtextextended(normalized_first || chr(0) || normalized_last, 0));

  select count(*)
  into match_count
  from public.members member
  where public.normalize_member_registration_name(member.first_name) = normalized_first
    and public.normalize_member_registration_name(member.last_name) = normalized_last;

  if match_count > 1 then
    insert into public.member_registration_reviews (
      request_id, cell_group_id, normalized_first_name, normalized_last_name,
      submitted_profile, matched_profile_count
    ) values (
      p_request_id, target_cell_group_id, normalized_first, normalized_last,
      jsonb_build_object(
        'first_name', clean_first,
        'last_name', clean_last,
        'nickname', nullif(btrim(coalesce(p_nickname, '')), ''),
        'gender', nullif(btrim(coalesce(p_gender, '')), ''),
        'birthday', p_birthday,
        'mobile', nullif(btrim(coalesce(p_mobile, '')), ''),
        'email', nullif(btrim(coalesce(p_email, '')), ''),
        'address', nullif(btrim(coalesce(p_address, '')), '')
      ),
      match_count
    ) on conflict (request_id) do nothing;

    return jsonb_build_object('status', 'needs_review');
  end if;

  if match_count = 1 and p_match_decision is null then
    select member.*
    into matched_member
    from public.members member
    where public.normalize_member_registration_name(member.first_name) = normalized_first
      and public.normalize_member_registration_name(member.last_name) = normalized_last
    limit 1;

    return jsonb_build_object(
      'status', 'needs_confirmation',
      'display_name', concat_ws(' ', matched_member.first_name, matched_member.last_name)
    );
  end if;

  if match_count = 1 and p_match_decision = 'confirm_existing' then
    select member.*
    into matched_member
    from public.members member
    where public.normalize_member_registration_name(member.first_name) = normalized_first
      and public.normalize_member_registration_name(member.last_name) = normalized_last
    limit 1
    for update;

    update public.members
    set first_name = clean_first,
        last_name = clean_last,
        nickname = coalesce(nullif(btrim(coalesce(p_nickname, '')), ''), matched_member.nickname),
        gender = coalesce(nullif(btrim(coalesce(p_gender, '')), ''), matched_member.gender),
        birthday = coalesce(p_birthday, matched_member.birthday),
        mobile = coalesce(nullif(btrim(coalesce(p_mobile, '')), ''), matched_member.mobile),
        email = coalesce(nullif(btrim(coalesce(p_email, '')), ''), matched_member.email),
        address = coalesce(nullif(btrim(coalesce(p_address, '')), ''), matched_member.address),
        cell_group_id = coalesce(matched_member.cell_group_id, target_cell_group_id)
    where id = matched_member.id;

    return jsonb_build_object('status', 'updated');
  end if;

  if match_count = 0 and p_match_decision = 'confirm_existing' then
    raise exception 'The existing profile is no longer available for confirmation' using errcode = 'P0002';
  end if;

  -- No match, or the registrant explicitly confirmed that the one exact match
  -- belongs to a different person. Duplicate human names remain valid.
  insert into public.members (
    first_name, last_name, nickname, gender, birthday, mobile, email, address,
    cell_group_id, membership_status, remarks
  ) values (
    clean_first,
    clean_last,
    coalesce(nullif(btrim(coalesce(p_nickname, '')), ''), ''),
    p_gender,
    p_birthday,
    coalesce(nullif(btrim(coalesce(p_mobile, '')), ''), ''),
    coalesce(nullif(btrim(coalesce(p_email, '')), ''), ''),
    coalesce(nullif(btrim(coalesce(p_address, '')), ''), ''),
    target_cell_group_id,
    'Visitor',
    ''
  );

  return jsonb_build_object('status', 'created');
end;
$$;

revoke all on function public.normalize_member_registration_name(text) from public, anon, authenticated;
revoke all on function public.submit_cell_group_member_registration(uuid,text,text,text,text,text,date,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_cell_group_member_registration(uuid,text,text,text,text,text,date,text,text,text,text) to anon, authenticated;

commit;
