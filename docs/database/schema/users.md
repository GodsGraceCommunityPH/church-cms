# Database Schema: Users

## Status

🚧 Planned

---

# Table

`users`

---

# Purpose

Represents application users who can authenticate and access GGCCC CMS.

A User Account is optional.

Not every church Member requires system access.

Authentication is handled by Supabase Auth.

This table stores application-specific information.

---

# Relationship

```
Supabase Auth

auth.users
      │
      │ 1
      ▼
users
      │
      │ 0..1
      ▼
members
```

---

# Columns

| Column        | Type        | Null | Default | Notes                        |
| ------------- | ----------- | ---- | ------- | ---------------------------- |
| id            | UUID        | No   | -       | PK, references auth.users.id |
| member_id     | UUID        | Yes  | -       | FK → members.id              |
| display_name  | TEXT        | No   | -       | Display name                 |
| avatar_url    | TEXT        | Yes  | -       | Optional                     |
| is_active     | BOOLEAN     | No   | TRUE    | Account enabled              |
| last_login_at | TIMESTAMPTZ | Yes  | -       | Updated after login          |
| created_at    | TIMESTAMPTZ | No   | now()   |                              |
| updated_at    | TIMESTAMPTZ | No   | now()   |                              |

---

# Primary Key

```
id
```

---

# Foreign Keys

| Column    | References    |
| --------- | ------------- |
| id        | auth.users.id |
| member_id | members.id    |

---

# Indexes

Recommended

```
member_id

is_active
```

---

# Business Rules

A User:

- must exist in Supabase Auth
- may or may not be linked to a Member
- may have multiple Roles
- may own audit records

Disabling a User should not delete historical data.

---

# Notes

Authentication credentials are never stored in this table.

Passwords, email verification, MFA, and sessions remain the responsibility of Supabase Auth.
