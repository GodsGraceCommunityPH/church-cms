# Architecture

## Overview

GGCCC CMS follows a feature-first architecture built around maintainability, readability, and long-term scalability.

The application is expected to grow over several years, so architectural consistency is prioritized over short-term convenience.

---

# Status

✅ Feature-first frontend architecture

✅ React + Vite + TypeScript

✅ Tailwind CSS v4

✅ Supabase backend

🚧 Training Management System

🚧 Finance

🚧 Ministries

💡 Notifications

💡 Mobile Application

---

# Technology Stack

## Frontend

- React 19
- Vite
- TypeScript
- React Router 7
- Tailwind CSS v4
- Lucide React

## Backend

Supabase

Responsibilities:

- Authentication
- PostgreSQL Database
- Storage
- Row Level Security
- API

---

# Frontend Structure

Current structure:

```
frontend/src/

assets/

components/

features/

hooks/

layouts/

lib/

pages/

services/

styles/

types/

utils/
```

The application uses a hybrid structure.

Shared UI lives in:

```
components/
```

Business functionality lives in:

```
features/
```

---

# Feature Structure

Each feature owns its implementation.

Example:

```
features/

members/

cellGroups/

join/

training/
```

A feature may contain:

```
components/

hooks/

services/

types/

utils/
```

Features should avoid depending directly on each other whenever practical.

---

# Shared Components

Reusable UI belongs in:

```
components/
```

Examples:

- Buttons
- Inputs
- Dialogs
- Tables
- Cards
- Badges

Business logic should not exist here.

---

# Services

Services communicate with Supabase.

Examples:

```
memberService.ts

trainingService.ts

cellGroupService.ts
```

Rules:

- Services contain data access.
- Components call services.
- Components should not contain SQL-like logic.

---

# State Management

Current approach:

React state

React hooks

Supabase

No global state library should be introduced unless a clear need emerges.

---

# Database Philosophy

Supabase is the single source of truth.

Guidelines:

- Do not duplicate database logic unnecessarily.
- Avoid generated database types.
- Keep database interactions readable.
- Keep queries centralized in services.

---

# Routing

React Router manages application routes.

Public routes remain separate from administrative routes.

Examples:

Public

- /
- /about
- /contact
- /give

Admin

- /admin
- /admin/dashboard
- /admin/members
- /admin/cell-groups

---

# Authentication

Supabase Authentication manages user identity.

Future permissions should be role-based.

Examples:

- Admin
- Pastor
- Trainer
- Cell Leader
- Ministry Leader
- Member

---

# UI Philosophy

The UI should emphasize:

- clarity
- consistency
- simplicity

Avoid decorative complexity.

Church volunteers with varying technical experience should feel comfortable using the application.

---

# Documentation

Project knowledge is divided into two locations.

## .ai/

Contains information intended primarily for AI assistants.

Examples:

- business rules
- architecture
- coding standards

## docs/

Contains developer documentation.

Examples:

- module specifications
- workflows
- database documentation
- UI guidelines

---

# Architectural Principles

Every feature should strive to satisfy these principles.

1. Single responsibility.

2. Low coupling.

3. High cohesion.

4. Reusable UI.

5. Clear separation of concerns.

6. Business rules documented before implementation.

7. Prefer extending existing architecture instead of introducing parallel patterns.

Maintaining consistency across the project is more valuable than introducing new architectural styles.
