# Database Philosophy

# Status

🚧 Active

---

# Purpose

This document defines the guiding principles for designing the GGCCC CMS database.

These principles apply to every table, relationship, and migration.

---

# Source of Truth

Supabase PostgreSQL is the single source of truth.

The frontend should never duplicate business data that already exists in the database.

Business rules should be enforced as close to the data as practical.

---

# Preserve History

Historical information is valuable.

Whenever possible:

- archive instead of delete
- deactivate instead of remove
- keep audit history

Examples include:

- completed training
- attendance
- finance transactions
- member transfers
- trainer recommendations

---

# Prefer Relationships Over Duplication

Avoid storing the same information in multiple places.

Instead of:

Member Name

Store:

Member ID

Use relationships to retrieve related information.

---

# Immutable Historical Records

Some records should never be modified after completion.

Examples:

- completed training
- finance transactions
- attendance history

Corrections should create audit records rather than overwrite history whenever practical.

---

# Soft Delete

Prefer soft deletion for business entities.

Typical implementation:

- is_active
- archived_at
- archived_by

Avoid permanently deleting records unless absolutely necessary.

---

# Normalize Until It Hurts

Design tables to minimize duplication while keeping queries understandable.

Avoid premature denormalization.

Optimize only when real performance issues appear.

---

# Business Logic

The database stores facts.

Business decisions belong in the application.

Example:

The database stores attendance.

The application decides whether someone should be recommended.

---

# IDs

Every primary table should use UUIDs.

Example:

- members.id
- training_programs.id
- training_classes.id
- enrollments.id

Never expose sequential IDs as business identifiers.

---

# Timestamps

Every business table should include:

- created_at
- updated_at

Where appropriate, also include:

- created_by
- updated_by

---

# Auditability

The system should answer questions like:

- Who changed this?
- When was it changed?
- What changed?

Design with traceability in mind.

---

# Naming Conventions

Tables

Plural, snake_case.

Examples:

- members
- cell_groups
- training_programs
- training_classes

Columns

snake_case.

Foreign Keys

<entity>\_id

Examples:

- member_id
- trainer_id
- class_id

---

# Future Growth

The schema should support:

- additional ministries
- multiple campuses
- expanded reporting
- future mobile applications
- integrations

Avoid designs that assume today's requirements are permanent.

---

# Guiding Principle

Design the database to represent the ministry faithfully.

Applications may change.

The data should remain reliable for years.
