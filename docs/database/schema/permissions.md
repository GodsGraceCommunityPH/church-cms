# Database Schema: Permissions

## Status

🚧 Planned

---

# Table

`permissions`

---

# Purpose

Defines the individual actions that can be performed within GGCCC CMS.

Permissions are assigned to Roles through the `role_permissions` table.

Users never receive Permissions directly.

---

# Columns

| Column      | Type        | Null | Default           | Notes                  |
| ----------- | ----------- | ---- | ----------------- | ---------------------- |
| id          | UUID        | No   | gen_random_uuid() | Primary Key            |
| code        | TEXT        | No   | -                 | Unique permission code |
| name        | TEXT        | No   | -                 | Display name           |
| module      | TEXT        | No   | -                 | Business module        |
| description | TEXT        | Yes  | -                 | Optional               |
| created_at  | TIMESTAMPTZ | No   | now()             |                        |
| updated_at  | TIMESTAMPTZ | No   | now()             |                        |

---

# Primary Key

```
id
```

---

# Unique Constraints

```
code
```

---

# Permission Naming Convention

Use:

```
module.action
```

Examples:

```
members.view

members.create

members.update

members.delete

training.view

training.enroll

training.attendance

finance.view

finance.create

ministries.manage
```

---

# Suggested Seed Permissions

## Members

- members.view
- members.create
- members.update
- members.archive

## Cell Groups

- cell_groups.view
- cell_groups.manage

## Training

- training.view
- training.create
- training.enroll
- training.attendance
- training.recommend
- training.complete

## Ministries

- ministries.view
- ministries.manage

## Finance

- finance.view
- finance.create
- finance.approve

## Administration

- admin.users
- admin.roles
- admin.permissions
- admin.settings

---

# Notes

Permissions define individual capabilities.

Roles group related Permissions together.
