# Database Relationships

# Status

🚧 Planned

---

# Purpose

This document defines the relationships between the primary entities of GGCCC CMS.

It serves as the canonical reference for foreign keys and business relationships.

---

# Guiding Principles

- Relationships should model real church operations.
- Preserve historical records whenever practical.
- Avoid duplicate relationships.
- Favor explicit junction tables for many-to-many relationships.

---

# High-Level Relationship Diagram

```
Members
│
├── Member Cell Groups
│       │
│       ▼
│   Cell Groups
│
├── Training Enrollments
│       │
│       ▼
│   Training Classes
│       │
│       ▼
│   Training Programs
│
├── Ministry Assignments
│       │
│       ▼
│   Ministries
│
└── Users (optional)
```

---

# Members

Primary Entity

Every major module ultimately references a Member.

Relationships

- One Member → Many Training Enrollments
- One Member → Many Ministry Assignments
- One Member → Many Finance Transactions (future)
- One Member → Many Audit Records
- One Member → Zero or One User Account

---

# Cell Groups

Relationship

```
Members
      ▲
      │
member_cell_groups
      │
      ▼
Cell Groups
```

Why a junction table?

Because Members may:

- transfer Cell Groups
- return to previous Cell Groups
- have historical reporting

The history should never be lost.

---

# Training

Relationship

```
Training Program

1

↓

Many

Training Classes

1

↓

Many

Training Enrollments

1

↓

Many

Attendance

Assignments

Trainer Notes

Recommendation

Completion
```

A Member may have many enrollments.

An Enrollment belongs to only one Training Class.

---

# Ministries

Relationship

```
Members

▲

│

member_ministries

│

▼

Ministries
```

A Member may serve in multiple Ministries.

A Ministry contains many Members.

---

# Authentication

Relationship

```
Users

1

↓

0..1

Members
```

Important:

A User Account is optional.

Not every Member needs system access.

Likewise, future administrative users may exist without being standard church Members.

---

# Trainers

Trainer is a role, not a separate entity.

Relationship

```
Members

↓

Users

↓

Role

↓

Trainer

↓

Training Class
```

Never create a separate Trainers table.

---

# Cell Leaders

Likewise,

Cell Leader is a role.

Not a table.

---

# Foreign Key Guidelines

Always reference UUID primary keys.

Examples

member_id

training_program_id

training_class_id

cell_group_id

ministry_id

Never reference business identifiers.

---

# Delete Behavior

Recommended defaults

Parent records should rarely cascade delete.

Instead:

- restrict deletion
- archive records
- preserve history

Historical data is more valuable than convenience.

---

# Future Relationships

Future modules may include:

- Events
- Prayer Requests
- Volunteer Scheduling
- Asset Management
- Counseling
- Visitor Follow-up

Each new module should reference existing entities whenever possible instead of duplicating data.

---

# Guiding Principle

Relationships should reflect ministry operations while preserving a complete historical record.

A relationship should answer not only "who is connected?" but also "how did they become connected, and when?"
