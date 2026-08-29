# Database Schema: Role Permissions

## Status

🚧 Planned

---

# Table

`role_permissions`

---

# Purpose

Assigns Permissions to Roles.

This table implements the Role-Based Access Control (RBAC) model.

---

# Relationship

```
Roles

▲
│
│
role_permissions
│
▼

Permissions
```

---

# Columns

| Column        | Type        | Null | Default           | Notes               |
| ------------- | ----------- | ---- | ----------------- | ------------------- |
| id            | UUID        | No   | gen_random_uuid() | Primary Key         |
| role_id       | UUID        | No   | -                 | FK → roles.id       |
| permission_id | UUID        | No   | -                 | FK → permissions.id |
| created_at    | TIMESTAMPTZ | No   | now()             |                     |

---

# Constraints

Unique

```
(role_id, permission_id)
```

---

# Business Rules

A Permission may belong to many Roles.

A Role may contain many Permissions.

Examples

Administrator

- Every Permission

Trainer

- training.view
- training.attendance
- training.recommend

Finance

- finance.view
- finance.create
- finance.approve

Cell Leader

- members.view
- cell_groups.view

---

# Notes

Users inherit Permissions through their assigned Roles.

Permissions should never be assigned directly to Users.

If user-specific exceptions become necessary in the future, implement a separate `user_permissions` table rather than modifying this design.
