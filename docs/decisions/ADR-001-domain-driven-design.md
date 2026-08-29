# ADR-001: Domain-Driven Design

## Status

Accepted

---

## Date

2026-07-31

---

## Context

GGCCC CMS is expected to grow beyond a simple member database.

Future modules include:

- Members
- Cell Groups
- Training
- Ministries
- Finance
- Events
- Prayer
- Reporting

Without clear ownership, business logic and data duplication would spread throughout the application.

---

## Decision

The application will follow a domain-oriented architecture.

Each module owns its own business data.

Examples:

- Members own personal information.
- Training owns enrollments and attendance.
- Finance owns financial transactions.
- Ministries own ministry assignments.

Modules communicate through foreign keys rather than duplicated data.

---

## Consequences

### Positive

- Clear ownership
- Less duplicated data
- Easier maintenance
- Better scalability
- Simpler testing

### Trade-offs

- More joins in queries
- More planning before implementation
- Requires discipline when adding new features

---

## Alternatives Considered

### Single large Members table

Rejected because it would eventually contain unrelated data from Training, Finance, and Ministries.

### Copying Member information into each module

Rejected because duplicated data becomes inconsistent over time.

---

## Rationale

Keeping each module responsible for its own business concepts produces a cleaner architecture and allows the system to grow without major redesign.

---

## Related Documents

- `docs/architecture/domain-glossary.md`
- `docs/database/bounded-contexts.md`
- `docs/database/relationships.md`
