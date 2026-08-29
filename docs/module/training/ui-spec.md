# Training Module UI Specification

# Status

🚧 Planned

---

# Purpose

This document defines the user interface of the Training Management System.

It describes pages, layouts, navigation, and user interactions.

It intentionally avoids implementation details.

---

# Design Philosophy

The Training module should prioritize clarity over visual complexity.

Church volunteers should be able to navigate the system with minimal training.

The interface should surface actionable information first.

---

# Navigation

Admin

```
Dashboard

↓

Training

    ├── Programs
    ├── Classes
    ├── Enrollments
    ├── Reports
```

---

# Primary Pages

## 1. Training Dashboard

Purpose

Provide an overview of the entire Training Management System.

Widgets

- Active Classes
- Upcoming Classes
- Members Currently Enrolled
- Members Awaiting Recommendation
- Members Ready for Next Training
- Members Requiring Remedials

Quick Actions

- Create Class
- Enroll Members
- View Reports

---

## 2. Training Programs

Purpose

Manage available training programs.

Table

Columns

- Name
- Description
- Active
- Display Order
- Total Classes

Actions

- Create
- Edit
- Archive

Examples

- SUYNL
- Life Class
- SOL 1
- SOL 2
- SOL 3

---

## 3. Training Classes

Purpose

Manage scheduled classes.

Card/Table Information

- Program
- Trainer
- Venue
- Capacity
- Schedule
- Status

Actions

- View
- Edit
- Cancel
- Duplicate

---

## 4. Class Details

The Class Details page becomes the operational workspace for trainers.

Header

Displays

- Program
- Trainer
- Schedule
- Venue
- Capacity
- Status

Tabs

- Overview
- Members
- Attendance
- Assignments
- Notes
- Reports

---

## 5. Members Tab

Displays enrolled members.

Columns

- Name
- Cell Group
- Attendance %
- Assignment Status
- Recommendation
- Completion

Actions

- View Profile
- Record Attendance
- Record Assignment
- Add Note

---

## 6. Attendance Tab

Displays every training session.

Example

```
Session 1

Session 2

Session 3

Session 4
```

Selecting a session opens attendance recording.

Attendance options

- Present
- Late
- Excused
- Absent

---

## 7. Assignments Tab

Displays assignment progress.

Columns

- Assignment
- Status
- Submitted
- Reviewed

Possible Status

- Assigned
- Submitted
- Returned
- Completed

---

## 8. Trainer Notes

Private observations.

Examples

- participation
- leadership
- attitude
- strengths
- concerns

Trainer Notes are visible only to authorized roles.

---

## 9. Recommendations

Trainer recommendation page.

Possible values

- Recommend
- Recommend Later
- Not Yet Ready

Optional comments should accompany recommendations.

---

## 10. Reports

Training reports.

Examples

- Current Enrollments
- Graduates
- Members Awaiting Recommendation
- Attendance Summary
- Trainer Workload
- Remedials

Reports should support export in future versions.

---

# Member Profile Integration

Every Member Profile should contain a Training section.

Example

```
Training

Life Class

Completed

Trainer

John Doe

Completed

January 2027

-------------------

SOL 1

In Progress

Attendance

6 / 8

Assignments

2 Remaining
```

This allows leaders to see a member's discipleship journey without navigating away.

---

# Dashboard Philosophy

The dashboard should answer:

"What needs my attention today?"

Examples

- Members absent twice
- Assignments overdue
- Recommendations pending
- Classes starting this week

Avoid dashboards that simply display statistics.

---

# Mobile Considerations

Future versions should remain usable on tablets.

Data-heavy tables may collapse into expandable cards on smaller screens.

---

# Guiding Principle

Every page should help leaders make disciples more effectively.

Avoid unnecessary clicks.

Surface important actions before secondary information.

Keep the workflow intuitive and ministry-focused.
