# Database Schema: Cell Groups

## Status

🚧 Planned

---

# Table

`cell_groups`

---

# Purpose

Stores the official Cell Groups of GGCCC.

A Cell Group is a discipleship community where Members are shepherded by a Cell Leader.

This table stores information about the Cell Group itself, not its members.

Membership is tracked separately in the `member_cell_groups` table to preserve transfer history.

---

# Columns

| Column                     | Type        | Null | Default           | Notes                |
| -------------------------- | ----------- | ---- | ----------------- | -------------------- |
| id                         | UUID        | No   | gen_random_uuid() | Primary Key          |
| code                       | TEXT        | Yes  | -                 | Optional unique code |
| name                       | TEXT        | No   | -                 | Cell Group name      |
| description                | TEXT        | Yes  | -                 | Optional             |
| leader_member_id           | UUID        | Yes  | -                 | Current Cell Leader  |
| assistant_leader_member_id | UUID        | Yes  | -                 | Optional             |
| meeting_day                | TEXT        | Yes  | -                 | e.g. Friday          |
| meeting_time               | TIME        | Yes  | -                 |                      |
| meeting_location           | TEXT        | Yes  | -                 |                      |
| status                     | TEXT        | No   | 'active'          | Active / Inactive    |
| created_at                 | TIMESTAMPTZ | No   | now()             |                      |
| updated_at                 | TIMESTAMPTZ | No   | now()             |                      |

---

# Primary Key

```
id
```

---

# Foreign Keys

| Column                     | References |
| -------------------------- | ---------- |
| leader_member_id           | members.id |
| assistant_leader_member_id | members.id |

---

# Unique Constraints

Recommended

```
code
```

Optional

```
name
```

Only if church policy requires unique Cell Group names.

---

# Indexes

Recommended

```
status

leader_member_id

name
```

---

# Referenced By

- member_cell_groups

---

# Business Rules

A Cell Group:

- may exist before Members are assigned
- should have at most one current leader
- may optionally have an assistant leader
- should never directly store Member lists

---

# Allowed Status Values

```
active

inactive
```

---

# Future Considerations

Possible future tables:

- cell_group_meetings
- cell_group_attendance
- cell_group_goals
- cell_group_reports

These should remain separate from the `cell_groups` table.

---

# Notes

The `cell_groups` table represents the group itself.

Membership history belongs in the `member_cell_groups` junction table.
