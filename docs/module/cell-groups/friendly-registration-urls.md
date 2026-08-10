# Friendly Cell Group registration URLs

Cell Groups use a friendly public slug for registration links while the Cell
Group UUID remains the permanent identity for every relationship.

The database generates `cell_groups.slug` from the group name and resolves a
collision with a numeric suffix. Renaming a group generates a new current slug.
`cell_group_slug_aliases` retains each previous slug, and
`cell_group_slug_reservations` prevents both current and historical slugs from
being assigned to another group.

The public resolver accepts a current slug, a historical alias, or an existing
legacy invite token and returns only registration-safe fields. An active
`cell_group_invites` row is still required, so a slug is an identifier rather
than authorization. Historical identifiers redirect to the current canonical
slug. Registration continues to resolve and store `cell_group_id`; names and
slugs are never used as foreign keys.
