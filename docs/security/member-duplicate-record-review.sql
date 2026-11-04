-- Read-only review for the two supplied production Member IDs.
-- Run against the intended production project using an authorized read-only role.
-- This query makes no changes. Compare the returned identity details privately
-- with the source records before deciding whether both rows are legitimate.
with requested(id, review_label) as (
  values
    ('61771f7f-b40e-41af-9dca-318c47515d4c'::uuid, 'Existing'),
    ('00705e7f-d775-4aba-ae2e-4436bc678aa8'::uuid, 'New')
)
select requested.review_label,
       m.id,
       m.first_name,
       m.last_name,
       m.nickname,
       m.gender,
       m.birthday,
       m.mobile,
       public.normalize_member_mobile(m.mobile) as normalized_mobile,
       m.email,
       m.address,
       m.membership_status,
       cg.name as cell_group,
       m.created_at,
       m.updated_at
from requested
left join public.members m on m.id = requested.id
left join public.cell_groups cg on cg.id = m.cell_group_id
order by requested.review_label;
