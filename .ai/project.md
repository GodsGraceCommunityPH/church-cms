# GGCCC CMS Project

## Project Overview

GGCCC CMS (God's Grace Community Covenant Church Management System) is a web-based church management system designed specifically for the workflow of God's Grace Community Covenant Church.

Unlike traditional Church Management Systems (ChMS), GGCCC CMS is built around **discipleship** rather than administration.

Administrative features exist to support ministry—not the other way around.

The long-term goal is to provide one unified system that manages people from their first visit to leadership development.

---

# Vision

Build a modern, maintainable, and scalable church management platform that helps leaders make disciples, train members, develop future leaders, and manage church operations efficiently.

---

# Mission

Provide church leaders with accurate information, streamlined workflows, and tools that reduce administrative work so they can focus on people instead of paperwork.

---

# Core Philosophy

This application is **not** a generic CRM.

It is a discipleship management system.

Every feature should ultimately answer one or more of these questions:

- Who is this person?
- Where are they in their spiritual journey?
- Who is discipling them?
- What training have they completed?
- What should happen next?

If a feature does not support people, discipleship, leadership, or church administration, it should be questioned before implementation.

---

# Primary Operational Module

The **Training Management System (TMS)** is the operational heart of the application.

While users will frequently navigate through Members, Cell Groups, Ministries, Finance, and Events, those modules primarily exist to provide context and support for the training journey.

Future development should always consider how a feature integrates with TMS.

---

# Target Users

The application is designed for multiple roles within the church.

## Visitors

People who have recently attended church or expressed interest.

Capabilities:

- Register online
- Submit basic information
- Receive invitations
- Become church members after approval

---

## Members

Church members who can:

- Maintain their own profile
- View training records
- View ministry assignments
- Receive announcements

---

## Cell Leaders

Responsible for managing their own Cell Group.

Capabilities include:

- Viewing assigned members
- Tracking member progress
- Monitoring training status
- Encouraging discipleship

---

## Trainers

Responsible for conducting classes and recording progress.

Capabilities include:

- Attendance
- Assignment tracking
- Remedials
- Notes
- Recommendations

---

## Ministry Leaders

Responsible for ministry members.

Future responsibilities may include:

- Scheduling
- Rosters
- Attendance
- Volunteer management

---

## Administrators

Responsible for maintaining church records and system configuration.

Capabilities include:

- Full CRUD access
- User management
- Reports
- System settings
- Master data management

---

# Current Technology Stack

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

Authentication

- Supabase Auth

Icons

- Lucide React

---

# Current Project Structure

Major folders currently include:

frontend/

backend/

database/

resources/

docs/

archive/

.ai/

---

# Frontend Architecture

The frontend follows a **feature-first architecture**.

Example:

features/

members/

cellGroups/

join/

Each feature owns:

- pages
- components
- hooks
- services
- types

Reusable UI belongs inside shared components.

Business logic should not live inside UI components.

---

# Database Philosophy

Supabase is the single source of truth.

The application communicates directly using the official Supabase JavaScript client.

Database types are intentionally **not generated**.

The database schema should remain understandable without relying on generated TypeScript files.

---

# Guiding Principles

When implementing new functionality:

1. Simplicity over cleverness.
2. Readability over brevity.
3. Reuse existing components.
4. Keep features loosely coupled.
5. Avoid duplicate business logic.
6. Preserve backwards compatibility whenever practical.

---

# Long-Term Modules

The long-term vision includes:

- Members
- Cell Groups
- Training Management System
- Ministries
- Finance
- Events
- Prayer Requests
- Reports
- Dashboard
- Notifications
- Public Website
- Visitor Registration
- User Administration

---

# Success Criteria

A successful GGCCC CMS should allow church leaders to answer questions such as:

- Who has completed Life Class?
- Who is ready for SOL 1?
- Which members are inactive?
- Which Cell Groups are growing?
- Which ministries need volunteers?
- Which assignments are overdue?
- Who has missed recent trainings?
- What is each member's discipleship progress?

Every future module should contribute toward answering these questions.
