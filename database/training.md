# Training Database

# Status

🚧 Planned

---

# Purpose

This document defines the database structure for the Training Management System (TMS).

The design separates reusable Training Programs from scheduled Training Classes, allowing the church to offer the same program multiple times while preserving historical records.

---

# Design Philosophy

The Training database models discipleship as a historical process.

Training records should never be overwritten.

Every enrollment represents a unique point in a Member's journey.

---

# Entity Relationship Overview

```
Training Program
        │
        │ 1
        ▼
Training Class
        │
        │ 1
        ▼
Enrollment
 ├── Attendance
 ├── Assignments
 ├── Trainer Notes
 ├── Recommendation
 └── Completion
```

---

# training_programs

Defines reusable training curricula.

Examples:

- SUYNL
- Life Class
- SOL 1
- SOL 2
- SOL 3

Suggested columns:

| Column        | Description      |
| ------------- | ---------------- |
| id            | UUID             |
| code          | Short identifier |
| name          | Program name     |
| description   | Optional         |
| display_order | Display sequence |
| is_active     | Active flag      |
| created_at    | Timestamp        |
| updated_at    | Timestamp        |

---

# training_classes

Represents a scheduled offering of a Training Program.

Examples:

- Life Class – January 2027
- Life Class – April 2027

Suggested columns:

| Column              | Description                                |
| ------------------- | ------------------------------------------ |
| id                  | UUID                                       |
| training_program_id | FK                                         |
| trainer_id          | Member assigned as trainer                 |
| venue               | Optional                                   |
| capacity            | Maximum participants                       |
| start_date          | Start                                      |
| end_date            | End                                        |
| status              | Draft, Open, Ongoing, Completed, Cancelled |
| created_at          | Timestamp                                  |
| updated_at          | Timestamp                                  |

---

# training_enrollments

Represents a Member participating in a specific Training Class.

Suggested columns:

| Column            | Description                    |
| ----------------- | ------------------------------ |
| id                | UUID                           |
| member_id         | FK                             |
| training_class_id | FK                             |
| enrolled_at       | Enrollment date                |
| enrolled_by       | User                           |
| status            | Enrolled, Withdrawn, Completed |
| created_at        | Timestamp                      |
| updated_at        | Timestamp                      |

---

# training_sessions

Represents individual class meetings.

Example:

Life Class

- Session 1
- Session 2
- Session 3
- Session 4

Suggested columns:

| Column            | Description  |
| ----------------- | ------------ |
| id                | UUID         |
| training_class_id | FK           |
| session_number    | Sequence     |
| topic             | Optional     |
| session_date      | Meeting date |
| created_at        | Timestamp    |

---

# training_attendance

Stores attendance for each session.

Suggested columns:

| Column              | Description                    |
| ------------------- | ------------------------------ |
| id                  | UUID                           |
| enrollment_id       | FK                             |
| training_session_id | FK                             |
| attendance_status   | Present, Late, Excused, Absent |
| remarks             | Optional                       |
| recorded_by         | User                           |
| recorded_at         | Timestamp                      |

---

# training_assignments

Defines assignments within a class.

Suggested columns:

| Column            | Description      |
| ----------------- | ---------------- |
| id                | UUID             |
| training_class_id | FK               |
| title             | Assignment title |
| description       | Optional         |
| due_date          | Optional         |

---

# training_assignment_submissions

Tracks each Member's assignment progress.

Suggested columns:

| Column        | Description                              |
| ------------- | ---------------------------------------- |
| id            | UUID                                     |
| assignment_id | FK                                       |
| enrollment_id | FK                                       |
| status        | Assigned, Submitted, Returned, Completed |
| reviewed_by   | User                                     |
| reviewed_at   | Timestamp                                |
| remarks       | Optional                                 |

---

# training_notes

Private observations recorded by Trainers.

Suggested columns:

| Column        | Description |
| ------------- | ----------- |
| id            | UUID        |
| enrollment_id | FK          |
| trainer_id    | Member      |
| note          | Observation |
| created_at    | Timestamp   |

---

# training_recommendations

Stores the Trainer's recommendation.

Suggested columns:

| Column         | Description                               |
| -------------- | ----------------------------------------- |
| id             | UUID                                      |
| enrollment_id  | FK                                        |
| recommendation | Recommend, Recommend Later, Not Yet Ready |
| remarks        | Optional                                  |
| recommended_by | User                                      |
| recommended_at | Timestamp                                 |

---

# training_completions

Records final approval of a completed Training Class.

Suggested columns:

| Column        | Description |
| ------------- | ----------- |
| id            | UUID        |
| enrollment_id | FK          |
| approved_by   | User        |
| completed_at  | Timestamp   |
| remarks       | Optional    |

---

# Historical Integrity

The Training database should preserve:

- Previous enrollments
- Repeated classes
- Withdrawals
- Attendance history
- Recommendations
- Trainer notes

No historical record should be overwritten.

---

# Future Expansion

The design should support:

- Multiple trainers
- Online classes
- File attachments
- Digital certificates
- Grading
- Attendance QR codes
- Training prerequisites

These features should be implemented without redesigning the core structure.

---

# Guiding Principle

The database should faithfully represent a Member's discipleship journey while preserving a complete and auditable history.
