begin;

create or replace function public.delete_unreferenced_member(p_member_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.has_permission('members.archive') then raise exception 'members.archive permission required' using errcode='42501'; end if;
  if exists(select 1 from public.member_trainings where member_id=p_member_id) then raise exception 'This member has Training or attendance history. Deactivate the member instead.' using errcode='P0001'; end if;
  if exists(select 1 from public.ministry_members where member_id=p_member_id) then raise exception 'This member has ministry assignments. Remove those assignments or deactivate the member instead.' using errcode='P0001'; end if;
  delete from public.members where id=p_member_id;
  if not found then raise exception 'Member not found' using errcode='P0002'; end if;
exception when foreign_key_violation then
  raise exception 'This member is referenced by church history and cannot be deleted. Deactivate the member instead.' using errcode='P0001';
end; $$;

revoke all on function public.delete_unreferenced_member(uuid) from public,anon;
grant execute on function public.delete_unreferenced_member(uuid) to authenticated;
commit;
