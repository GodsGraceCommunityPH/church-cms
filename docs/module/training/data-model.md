# Training Data Model

# Status

🚧 Planned

---

# Purpose

This document defines the logical data model of the Training Management System.

It is intentionally independent of the database implementation.

Database tables should support this model rather than define it.

---

# Overview

The Training Management System is composed of several independent entities.

```
Training Program
        │
        ▼
Training Class
        │
        ▼
Enrollment
        │
        ▼
Attendance
        │
        ├──────────────┐
        ▼              ▼
Assignments      Trainer Notes
        │
        ▼
Recommendation
        │
        ▼
Completion
```

---

# Entity: Training Program

Represents a type of training.

Examples:

- SUYNL
- Life Class
- SOL 1
- SOL 2
- SOL 3

A Training Program is a template.

It is **not** a scheduled class.

---

## Responsibilities

- Name
- Description
- Display order
- Active status

---

## Relationships

One Training Program

↓

Many Training Classes

---

# Entity: Training Class

Represents one scheduled offering of a Training Program.

Examples:

Life Class
January 2027

Life Class
April 2027

SOL 1
August 2027

Each Training Class has:

- trainer
- schedule
- enrolled members

---

## Responsibilities

- Training Program
- Trainer
- Start date
- End date
- Venue
- Capacity
- Status
- Required sessions
- Attendance cadence (v1: every 7 days)
- Whether Excused attendance counts
- An extensible Completion Checklist

---

## Relationships

One Training Class

↓

Many Enrollments

---

# Entity: Enrollment

Represents one member participating in one Training Class.

Enrollment is the center of the Training module.

Every training record belongs to an Enrollment.

---

## Responsibilities

- Member
- Class
- Enrollment date
- Status

Possible statuses:

- Enrolled
- Withdrawn
- Completed
- Cancelled

---

## Relationships

One Enrollment

↓

Many Attendance Records

↓

Many Assignment Records

↓

Many Trainer Notes

↓

One Recommendation

↓

One Completion Record

---

# Entity: Attendance

Represents attendance for a single session.

Attendance should never summarize multiple sessions into one record.

Each class meeting generates its own attendance record.

---

Possible values

- Present
- Late
- Excused
- Absent

---

# Entity: Assignment

Assignments belong to an Enrollment.

Each assignment tracks progress independently.

Possible statuses:

- Assigned
- Submitted
- Returned
- Completed

Assignments should never overwrite previous submissions.

---

# Entity: Trainer Note

Trainer Notes capture observations that cannot be measured by attendance alone.

Examples:

- participation
- attitude
- leadership potential
- concerns
- encouragement

Trainer Notes become valuable during recommendation.

---

# Entity: Recommendation

Represents the trainer's assessment.

Possible outcomes include:

- Recommend
- Recommend Later
- Not Yet Ready

Recommendation is advisory.

It does not automatically advance the member.

---

# Entity: Completion

Represents the successful completion of a Training Class.

Completion records should include:

- completion date
- approved by
- remarks

Completion is permanent historical data.

Completion eligibility is evaluated from the class Completion Checklist. The
checklist stores requirement keys and configuration rather than hard-coding
attendance into the enrollment schema. GGCCC v1 enables only
`required_attendance`; future workbook, interview, or memory-verse criteria can
be added without restructuring classes, enrollments, or completion actions.

---

# Relationships Summary

```
Training Program

1

↓

Many

Training Class

1

↓

Many

Enrollment

1

↓

Many

Attendance

Enrollment

1

↓

Many

Assignments

Enrollment

1

↓

Many

Trainer Notes

Enrollment

1

↓

1

Recommendation

Enrollment

1

↓

1

Completion
```

---

# Design Principles

The Training module intentionally separates:

Training Program

↓

Training Class

↓

Enrollment

These represent different concepts.

Keeping them separate allows:

- multiple classes of the same program
- historical reporting
- trainer reassignment
- flexible scheduling
- future expansion

This separation should be preserved throughout the application.

---

# Future Expansion

The model should support future entities without redesign.

Examples include:

- Certificates
- Class Materials
- Exams
- Digital Signatures
- QR Attendance
- Online Sessions

The core relationships should remain stable even as new features are introduced.
