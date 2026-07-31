# AGENTS.md

# GGCCC CMS

This repository contains the source code for the **God's Grace Community Covenant Church Management System (GGCCC CMS)**.

The purpose of this file is to onboard any AI coding assistant (Codex, ChatGPT, Claude Code, Cursor, Gemini CLI, etc.) before making code changes.

---

# Mission

Build a modern Church Management System focused on **discipleship**, **training**, **leadership development**, and **church administration**.

This is **not** intended to be a generic business CRM.

The application should reflect the workflow of GGCCC.

---

# Primary Goal

The system exists to help leaders disciple people.

Everything else supports that goal.

---

# Core Philosophy

The Training Management System (TMS) is the operational core of the application.

Modules such as:

- Members
- Cell Groups
- Ministries
- Finance
- Events

exist to support the discipleship and leadership process.

Whenever architectural decisions are required, prioritize what benefits the Training module.

---

# Tech Stack

Frontend

- React 19
- Vite
- TypeScript
- Tailwind CSS v4
- React Router 7

Backend

- Supabase

Database

- PostgreSQL (Supabase)

---

# Architecture

The frontend follows a **feature-first architecture**.

Business logic should remain inside feature modules and services.

Reusable UI belongs in shared components.

Avoid putting business rules directly inside React components.

---

# Supabase

Supabase is the single source of truth.

Use the official Supabase JavaScript client.

Do NOT generate database types.

Do NOT duplicate business logic between frontend and database unless necessary.

---

# Coding Principles

Prefer:

- readable code
- maintainable code
- reusable components
- composition over duplication

Avoid:

- overly clever abstractions
- premature optimization
- deeply nested components
- large files

---

# Documentation

Project documentation is stored in:

.ai/

and

docs/

Before implementing major features, review the relevant documentation.

If implementation changes the architecture or business rules, update the documentation in the same pull request.

---

# Business Rules

Business rules are authoritative.

Always consult:

.ai/business-rules.md

before modifying application logic.

---

# When Adding Features

Before writing code:

1. Understand the business problem.
2. Follow existing architecture.
3. Reuse existing components when possible.
4. Keep code consistent with surrounding features.
5. Update documentation if needed.

---

# Goal for AI Assistants

When contributing to this project:

- think like a senior software engineer
- preserve consistency
- avoid unnecessary rewrites
- prefer incremental improvements
- explain architectural trade-offs when appropriate

The objective is to help grow the project without increasing technical debt.

---

# Delivery Workflow

For completed coding tasks:

1. Verify the change with the relevant build, tests, linting, and UI checks.
2. Commit only the files that belong to the completed task.
3. Push the commit to the current tracked branch.
4. Confirm that the production deployment triggered by that branch succeeds.
5. Do not report the task as complete until the push and production deployment
   are confirmed.

If production deployment is not configured, credentials are unavailable, or
deployment fails, clearly report the blocker and the exact remaining action.
Never silently treat a local-only or committed-only change as production-ready.
