# Training Workflow

# Status

Operational v1

---

# Purpose

This document defines the operational workflow of the Training Management System (TMS).

It describes how a member progresses through training, who is responsible for each stage, and how the application should record that progress.

This workflow is considered the authoritative business process for the Training module.

---

# Current Class Workflow

Create Class → Enroll Students → Start Class → Record Attendance → Eligible for
Completion → Complete Student → Close Class.

Starting a class synchronizes all pending students to In Progress and applies
the class start date. Attendance is edited only in Current Class. Student
profiles are read-only progress records except for Trainer Notes.

# Completion Checklist

Completion is governed by an extensible checklist. For v1, the only enabled
requirement is required attendance. Present and Late count; Excused is a
per-class setting; Absent does not count. Completion occurs only from Current
Class after eligibility. Administrators retain an exceptional override.

# Philosophy

Training is a ministry process, not an automated process.

The system records and assists.

Church leadership decides.

Whenever there is conflict between automation and leadership, leadership always takes precedence.

---

# High-Level Workflow

```
Visitor
    │
    ▼
Member
    │
    ▼
Eligible for Training
    │
    ▼
Enrollment
    │
    ▼
Attend Sessions
    │
    ▼
Complete Assignments
    │
    ▼
Remedials (if necessary)
    │
    ▼
Trainer Evaluation
    │
    ▼
Leader Recommendation
    │
    ▼
Administrative Approval
    │
    ▼
Training Completed
    │
    ▼
Eligible for Next Training
```

---

# Stage 1 — Eligibility

A member becomes eligible for a training based on church leadership.

Eligibility is **not** determined automatically by the system.

Possible considerations include:

- previous training
- spiritual maturity
- attendance
- discipleship readiness
- leadership recommendation

The application may display suggested candidates, but should never enroll them automatically.

---

# Stage 2 — Enrollment

Administrator responsibilities:

- create class
- assign trainer
- assign schedule
- enroll members

Trainer responsibilities:

- verify roster

Member responsibilities:

- attend scheduled classes

Enrollment creates a training record.

For SUYNL and LifeClass, enrollment also selects a Guide and snapshots the
student's current Cell Group and Cell Leader. A Guide is not the class Trainer,
may serve multiple students, and may change without losing assignment history.
Guide assignment is informational and does not grant permissions.

Attendance has not yet occurred.

---

# Stage 3 — Attendance

Each session records attendance.

Possible attendance states:

- Present
- Late
- Excused

During an active session, an unchecked student remains Not Marked. Not Marked
is a frontend draft state and is not written as an attendance record. The
session-completion confirmation converts remaining Not Marked students to
Absent only after the Teacher confirms completion.

Teachers may reorder students within Female and Male roster sections and may
reorder the two section headers. The class saves this order independently from
attendance and Training workflow state.
- Absent

Completed sessions remain completed and read-only. If one student's historical
attendance or configured requirement result is wrong, a Teacher corrects only
that student record and supplies a required reason. The correction preserves
the old and new values, actor, timestamp, class, session, and student in the
existing workflow-event audit history; it does not reopen the session or alter
other students.

---

# Stage 4 — Assignments

The current implementation supports multiple configurable, named session
requirements. Names are reusable within a Training program, while each session
explicitly selects which names apply. A session may select none, one, or many;
there is no automatic program-wide assignment. Completion is recorded per
student only for the requirements assigned to that session, remains separate
from attendance, and does not yet block completion. Completed-session
configuration is frozen. Orientation remains a normal named session. Future
SOL-specific behavior is not yet defined.

Removing an editable session assignment is blocked when student progress
already exists, preventing hidden or orphaned progress. Teachers must clear the
current-session progress intentionally before removing that assignment.

Assignments measure participation and understanding.

Assignment status may include:

- Not Assigned
- Assigned
- Submitted
- Returned
- Completed

Assignments are independent from attendance.

A member may:

- attend but miss assignments
- complete assignments later
- complete assignments before another member

---

# Stage 5 — Remedials

Remedials exist to help members complete outstanding requirements.

Examples:

- missed lesson
- incomplete assignment
- make-up session
- additional coaching

Completing remedials updates training progress.

It should not erase historical attendance.

---

# Stage 6 — Trainer Evaluation

After all requirements have been satisfied, the trainer evaluates the member.

Possible outcomes include:

- Ready
- Needs More Growth
- Continue Observation
- Repeat Training

Trainer evaluation is advisory.

---

# Stage 7 — Recommendation

A trainer may recommend the member for advancement.

Recommendation indicates confidence in the member's readiness.

Recommendation does not automatically:

- graduate
- enroll
- advance

---

# Stage 8 — Administrative Approval

Church leadership determines final advancement.

Approval may consider:

- trainer recommendation
- pastoral input
- class availability
- church scheduling

The system records the decision.

---

# Stage 9 — Completion

Completion closes the member's enrollment.

Training history becomes permanent.

Historical records should remain available for future reporting.

---

# Stage 10 — Next Training

Completion may make the member eligible for another training.

Eligibility should be displayed as a suggestion.

The application should never automatically enroll a member into the next class.

---

# Exceptional Scenarios

## Member Withdraws

Training record remains.

Status becomes Withdrawn.

---

## Member Transfers Cell Group

Training history remains unchanged.

Cell Group changes should not affect completed training.

---

## Trainer Changes

Trainer assignments may change.

Historical records should preserve the original trainer whenever possible.

---

## Schedule Changes

Training schedules may change.

Historical attendance should remain accurate.

---

# Guiding Principle

The workflow exists to support church leadership.

The application assists decision-making.

It does not replace leadership judgment.
