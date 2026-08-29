# Entity Relationship Diagram (ERD)

# Status

🚧 Planned

---

# Purpose

This document provides a high-level overview of the GGCCC CMS database.

It focuses on how entities relate to one another rather than column-level details.

This document should remain readable by both technical and non-technical stakeholders.

---

# Core Domain

```
Members
│
├── Member Cell Groups
│       │
│       ▼
│   Cell Groups
│
├── Users
│       │
│       ▼
│   User Roles
│       │
│       ▼
│     Roles
│       │
│       ▼
│ Role Permissions
│       │
│       ▼
│ Permissions
│
├── Training Enrollments
│       │
│       ▼
│ Training Classes
│       │
│       ▼
│ Training Programs
│
│
├── Ministry Assignments (Future)
│
├── Finance Transactions (Future)
│
└── Audit Logs (Future)
```

---

# Members

The central entity.

Every major module references Members.

Members do not depend on any other module.

---

# Cell Groups

Cell Groups are independent entities.

Membership history is stored separately using Member Cell Groups.

---

# Authentication

Authentication is built on Supabase Auth.

Application users extend the Auth user through the Users table.

```
auth.users

↓

users
```

---

# Authorization

```
users

↓

user_roles

↓

roles

↓

role_permissions

↓

permissions
```

A User may have multiple Roles.

A Role may have multiple Permissions.

---

# Training

```
Training Program

↓

Training Class

↓

Enrollment

├── Attendance

├── Assignments

├── Notes

├── Recommendation

└── Completion
```

Training references Members.

Training never owns Member information.

---

# Future Modules

Future modules should reference existing entities whenever possible.

Examples

Finance

↓

member_id

NOT

member_name

---

# Design Principles

- Single source of truth
- Preserve history
- Normalize data
- Clear ownership
- UUID primary keys
- Soft delete where appropriate
- Role-based authorization

---

# Guiding Principle

The ERD should evolve with the application while preserving the overall architectural direction.
