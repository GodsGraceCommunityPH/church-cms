begin;

alter table public.cell_groups
  add column if not exists created_by uuid references public.users(id) default auth.uid();

alter table public.cell_groups alter column created_by set default auth.uid();

drop policy if exists "Cell groups read within assigned scope" on public.cell_groups;
create policy "Cell groups read within assigned scope"
on public.cell_groups for select to authenticated
using (
  public.has_permission('cell_groups.view')
  and (
    created_by = auth.uid()
    or not exists (
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid() and r.code = 'cell_leader'
    )
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.is_active
        and public.cell_groups.leader_member_id = u.member_id
    )
  )
);

commit;