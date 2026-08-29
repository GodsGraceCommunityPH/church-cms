# Database Schema: User Roles

## Status

🚧 Planned

---

# Table

`user_roles`

---

# Purpose

Assigns one or more Roles to a User.

Supports a flexible authorization model where a User may hold multiple responsibilities.

---

# Relationship

```
Users

▲
│
│
user_roles
│
▼

Roles
```

---

# Columns

| Column      | Type        | Null | Default           | Notes         |
| ----------- | ----------- | ---- | ----------------- | ------------- |
| id          | UUID        | No   | gen_random_uuid() | Primary Key   |
| user_id     | UUID        | No   | -                 | FK → users.id |
| role_id     | UUID        | No   | -                 | FK → roles.id |
| assigned_at | TIMESTAMPTZ | No   | now()             |               |
| assigned_by | UUID        | Yes  | -                 | FK → users.id |

---

# Constraints

Unique

```
(user_id, role_id)
```

This prevents duplicate role assignments.

---

# Business Rules

A User may have:

- one Role
- multiple Roles
- no Roles (inactive or pending setup)

Examples

John

- Trainer
- Cell Leader

Mary

- Finance

Pastor James

- Pastor
- Administrator

---

# Notes

Never add role columns directly to the `users` table.

The junction table keeps authorization flexible and scalable.
