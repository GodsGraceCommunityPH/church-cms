begin;

-- The normalized-name expression index added by migration 039 evaluates this
-- function for every members insert/update. Authenticated staff therefore need
-- EXECUTE while writing permitted member records. The function only normalizes
-- its text argument and does not expose table data.
revoke all on function public.normalize_member_registration_name(text)
  from public, anon;
grant execute on function public.normalize_member_registration_name(text)
  to authenticated;

commit;
