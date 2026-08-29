# Database Schema: Members

## Status

🚧 Planned

---

# Table

`members`

---

# Purpose

Stores the official record of every church member.

This table is the primary business entity of GGCCC CMS.

---

# Columns

| Column        | Type        | Null | Default           | Notes                                      |
| ------------- | ----------- | ---- | ----------------- | ------------------------------------------ |
| id            | UUID        | No   | gen_random_uuid() | Primary Key                                |
| member_number | TEXT        | Yes  | -                 | Human-friendly identifier                  |
| first_name    | TEXT        | No   | -                 |                                            |
| middle_name   | TEXT        | Yes  | -                 |                                            |
| last_name     | TEXT        | No   | -                 |                                            |
| suffix        | TEXT        | Yes  | -                 | Jr., Sr., III                              |
| sex           | TEXT        | No   | -                 | Male / Female                              |
| birth_date    | DATE        | Yes  | -                 |                                            |
| civil_status  | TEXT        | Yes  | -                 |                                            |
| email         | TEXT        | Yes  | -                 |                                            |
| mobile_number | TEXT        | Yes  | -                 |                                            |
| address       | TEXT        | Yes  | -                 |                                            |
| status        | TEXT        | No   | 'active'          | Active / Inactive / Transferred / Deceased |
| date_joined   | DATE        | Yes  | -                 | Official membership date                   |
| notes         | TEXT        | Yes  | -                 | Administrative notes                       |
| created_at    | TIMESTAMPTZ | No   | now()             |                                            |
| updated_at    | TIMESTAMPTZ | No   | now()             |                                            |

---

# Primary Key

```
id
```

---

# Unique Constraints

Recommended

```
member_number
```

Optional

```
email
```

Only if your church intends to require unique email addresses.

---

# Indexes

Recommended

```
last_name

status

member_number
```

Optional

```
email

mobile_number
```

---

# Foreign Keys

None.

The Members table is referenced by other tables.

---

# Referenced By

Future tables

- users
- member_cell_groups
- training_enrollments
- ministry_assignments
- finance_transactions
- audit_logs

---

# Business Rules

A Member:

- may exist without a User Account
- may exist without a Cell Group
- may exist without Training
- may exist without Ministry assignments

The Members table should not depend on any other module.

---

# Validation Rules

Required

- first_name
- last_name
- sex
- status

Optional

Everything else.

---

# Allowed Status Values

```
active

inactive

transferred

deceased
```

---

# Future Considerations

Avoid adding unrelated columns.

If a feature introduces a new business concept, prefer creating a new table rather than expanding the Members table indefinitely.

Examples

Good

```
member_baptisms

member_families

member_emergency_contacts
```

Avoid

Adding dozens of nullable columns directly to `members`.

---

# Notes

The Members table represents identity.

Other modules should reference Members using `member_id`.
