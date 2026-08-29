# Coding Style Guide

This document defines the coding standards for GGCCC CMS.

The objective is consistency rather than personal preference.

Whenever multiple solutions are technically correct, prefer the one that matches the existing project.

---

# Philosophy

Write code that church volunteers and future developers can understand.

Optimize for readability and maintainability.

Avoid clever code that requires explanation.

---

# General Principles

Prefer:

- small functions
- descriptive names
- reusable components
- explicit logic
- predictable structure

Avoid:

- unnecessary abstraction
- deeply nested conditions
- duplicated business logic
- magic values
- oversized components

---

# TypeScript

Always use TypeScript.

Avoid `any` whenever possible.

Prefer explicit interfaces for application models.

Example:

```ts
interface Member {
  id: string;
  firstName: string;
  lastName: string;
}
```

---

# Naming

Use descriptive names.

Good

```
MemberProfileCard
TrainingAttendanceTable
assignMemberToCellGroup()
```

Avoid

```
Card2
Data
Helper
Temp
handleThing()
```

---

# Components

A component should have one primary responsibility.

Good

```
MemberProfileHeader

TrainingCard

AttendanceTable
```

Avoid components that attempt to manage an entire page.

---

# Component Size

General guideline:

- under 150 lines is preferred

If a component grows significantly larger, consider extracting child components.

This is guidance, not a strict rule.

---

# Business Logic

Business rules should never be hidden inside JSX.

Instead:

```
UI

↓

Hook

↓

Service

↓

Supabase
```

---

# Services

Services own data access.

Example

```
memberService.ts

trainingService.ts

financeService.ts
```

Responsibilities include:

- fetching

- inserting

- updating

- deleting

- mapping database results

Services should not render UI.

---

# React Hooks

Extract reusable logic into custom hooks.

Example

```
useMembers()

useTraining()

useCellGroups()
```

Avoid repeating fetch logic across pages.

---

# Folder Ownership

Each feature owns its implementation.

Example

```
features/

members/

cellGroups/

training/
```

Avoid placing feature-specific code inside shared folders.

---

# Shared Components

Shared UI belongs inside:

```
components/
```

Examples

- Button

- Input

- Modal

- Badge

- Table

These components should remain business-agnostic.

---

# Styling

Tailwind CSS is the primary styling solution.

Avoid inline styles unless absolutely necessary.

Prefer utility classes.

Maintain consistent spacing throughout the application.

---

# Icons

Use Lucide React.

Use icons only where they improve clarity.

Avoid decorative icons.

---

# Error Handling

Handle expected failures gracefully.

Display useful error messages.

Avoid exposing raw database errors to users.

Log unexpected errors for debugging.

---

# Comments

Prefer self-explanatory code.

Comments should explain **why**, not **what**.

Good

```ts
// Preserve historical records for reporting.
```

Avoid

```ts
// Increment count.
count++;
```

---

# Database Access

All Supabase interaction should remain inside services.

Avoid querying Supabase directly inside React components.

---

# Documentation

Whenever a significant architectural or business-rule change is introduced:

Update:

- AGENTS.md (if needed)

- .ai/business-rules.md

- relevant docs/

Documentation is part of the codebase.

---

# Pull Request Checklist

Before considering work complete:

- Code compiles.

- Types are correct.

- Existing architecture is respected.

- Business rules remain valid.

- Documentation is updated when necessary.

- No unnecessary duplication has been introduced.

---

# Definition of Done

A feature is complete only when:

- functionality works

- code is readable

- architecture remains consistent

- business rules are respected

- documentation reflects the implementation
