# Database Schema: Member Cell Groups

## Status

🚧 Planned

---

# Table

`member_cell_groups`

---

# Purpose

Tracks a Member's Cell Group membership over time.

This table preserves historical transfers and identifies the Member's current Cell Group.

It implements a many-to-many relationship between Members and Cell Groups with temporal history.

---

# Columns

| Column          | Type        | Null | Default           | Notes                    |
| --------------- | ----------- | ---- | ----------------- | ------------------------ |
| id              | UUID        | No   | gen_random_uuid() | Primary Key              |
| member_id       | UUID        | No   | -                 | FK → members.id          |
| cell_group_id   | UUID        | No   | -                 | FK → cell_groups.id      |
| joined_at       | DATE        | No   | CURRENT_DATE      | Date joined              |
| left_at         | DATE        | Yes  | -                 | Date left the Cell Group |
| transfer_reason | TEXT        | Yes  | -                 | Optional                 |
| is_current      | BOOLEAN     | No   | TRUE              | Current assignment       |
| assigned_by     | UUID        | Yes  | -                 | FK → users.id            |
| created_at      | TIMESTAMPTZ | No   | now()             |                          |
| updated_at      | TIMESTAMPTZ | No   | now()             |                          |

---

# Primary Key

```
id
```

---

# Foreign Keys

| Column        | References          |
| ------------- | ------------------- |
| member_id     | members.id          |
| cell_group_id | cell_groups.id      |
| assigned_by   | users.id (optional) |

---

# Indexes

Recommended

```
member_id

cell_group_id

is_current

joined_at
```

Composite

```
(member_id, is_current)
```

This allows quick lookup of a Member's current Cell Group.

---

# Business Rules

A Member may belong to many Cell Groups over their lifetime.

A Member should have **at most one** record where:

```
is_current = true
```

When a transfer occurs:

1. Update the current record:
   - `left_at`
   - `is_current = false`

2. Insert a new record for the new Cell Group.

Never overwrite historical assignments.

---

# Historical Reporting

This design supports questions such as:

- Which Cell Group is this Member currently assigned to?
- Which Cell Groups has this Member belonged to?
- When did they transfer?
- How long were they in each Cell Group?
- Who assigned the transfer?

---

# Constraints

Recommended unique partial constraint:

```sql
UNIQUE (member_id)
WHERE is_current = TRUE
```

This guarantees a Member can only have one active Cell Group assignment.

---

# Delete Behavior

Never delete historical records.

If a transfer is incorrect, create a new transfer or update according to church policy while preserving audit history.

---

# Future Considerations

Possible future columns:

- role_in_group
- transfer_type
- approved_by
- notes

Avoid storing attendance or meeting participation in this table.

---

# Notes

This table owns the history of Cell Group membership.

The `cell_groups` table defines the group.

The `members` table defines the person.

This table defines the relationship between them over time.
