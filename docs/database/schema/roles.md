# Database Schema: Roles

## Status

🚧 Planned

---

# Table

`roles`

---

# Purpose

Defines the available application roles.

Roles determine what Users are allowed to do within GGCCC CMS.

Roles are assigned through the `user_roles` table.

---

# Columns

| Column      | Type        | Null | Default           | Notes             |
| ----------- | ----------- | ---- | ----------------- | ----------------- |
| id          | UUID        | No   | gen_random_uuid() | Primary Key       |
| code        | TEXT        | No   | -                 | Unique identifier |
| name        | TEXT        | No   | -                 | Display name      |
| description | TEXT        | Yes  | -                 | Optional          |
| is_system   | BOOLEAN     | No   | TRUE              | Protected role    |
| created_at  | TIMESTAMPTZ | No   | now()             |                   |
| updated_at  | TIMESTAMPTZ | No   | now()             |                   |

---

# Unique Constraints

```
code
```

---

# Suggested Seed Data

| Code            | Name            |
| --------------- | --------------- |
| administrator   | Administrator   |
| pastor          | Pastor          |
| trainer         | Trainer         |
| cell_leader     | Cell Leader     |
| ministry_leader | Ministry Leader |
| finance         | Finance         |
| member          | Member          |

---

# Notes

Roles define responsibilities.

Permissions are granted through application logic and Row Level Security (RLS).
