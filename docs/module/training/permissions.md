# Training Module Permissions

# Status

🚧 Planned

---

# Purpose

This document defines the authorization rules for the Training Management System.

It describes which roles may perform specific actions.

This document defines **business permissions**, not technical implementation.

How permissions are enforced (Supabase RLS, frontend guards, middleware, etc.) is an implementation detail.

---

# Design Principles

## Least Privilege

Users should only receive the permissions required to perform their ministry responsibilities.

Avoid giving broader access than necessary.

---

## Separation of Responsibility

Training responsibilities are intentionally divided.

Examples:

- Administrators manage classes.
- Trainers evaluate members.
- Cell Leaders monitor progress.
- Members view their own records.

---

## Leadership Override

Pastoral leadership may override normal workflow decisions.

The application should support leadership, not restrict it.

---

# Roles

Current planned roles:

- Administrator
- Pastor
- Trainer
- Cell Leader
- Member

Future roles may be added without redesigning the permission model.

---

# Administrator

Administrators have full operational access.

Allowed actions include:

✅ Create Training Programs

✅ Edit Training Programs

✅ Archive Training Programs

✅ Create Training Classes

✅ Edit Training Classes

✅ Cancel Training Classes

✅ Assign Trainers

✅ Enroll Members

✅ Remove Enrollments

✅ View All Reports

✅ Manage Historical Records

Administrators should not routinely modify trainer observations unless necessary.

---

# Pastor

Pastors provide oversight.

Allowed actions include:

✅ View all training records

✅ View trainer notes

✅ View recommendations

✅ Approve advancement

✅ Override recommendations

✅ View reports

Pastoral decisions should always be recorded.

Whenever practical, overrides should include remarks.

---

# Trainer

Trainers manage assigned classes.

Allowed actions:

✅ View assigned classes

✅ Record attendance

✅ Manage assignments

✅ Record remedials

✅ Add trainer notes

✅ Submit recommendations

✅ Mark completion

Trainers should only access members assigned to their own classes unless granted additional permissions.

---

# Cell Leader

Cell Leaders monitor discipleship.

Allowed actions:

✅ View members within their Cell Group

✅ View training progress

✅ View completed trainings

✅ View current enrollment

Cell Leaders should not modify official training records.

They may eventually submit observations or recommendations if the church chooses to support that workflow.

---

# Member

Members have read-only access to their own information.

Allowed actions:

✅ View completed trainings

✅ View current enrollments

✅ View attendance summary

✅ View assignment status

Members may not:

❌ Edit attendance

❌ Edit recommendations

❌ Edit trainer notes

❌ Mark themselves complete

---

# Permission Matrix

| Action                | Admin | Pastor | Trainer | Cell Leader |  Member  |
| --------------------- | :---: | :----: | :-----: | :---------: | :------: |
| Create Program        |  ✅   |   ❌   |   ❌    |     ❌      |    ❌    |
| Edit Program          |  ✅   |   ❌   |   ❌    |     ❌      |    ❌    |
| Create Class          |  ✅   |   ❌   |   ❌    |     ❌      |    ❌    |
| Assign Trainer        |  ✅   |   ❌   |   ❌    |     ❌      |    ❌    |
| Enroll Members        |  ✅   |   ❌   |   ❌    |     ❌      |    ❌    |
| Record Attendance     |  ✅   |   ❌   |   ✅    |     ❌      |    ❌    |
| Record Assignments    |  ✅   |   ❌   |   ✅    |     ❌      |    ❌    |
| Record Remedials      |  ✅   |   ❌   |   ✅    |     ❌      |    ❌    |
| Add Trainer Notes     |  ✅   |   ❌   |   ✅    |     ❌      |    ❌    |
| Recommend Advancement |  ✅   |   ✅   |   ✅    |     ❌      |    ❌    |
| Approve Advancement   |  ✅   |   ✅   |   ❌    |     ❌      |    ❌    |
| View Reports          |  ✅   |   ✅   | Limited |   Limited   | Own Only |

---

# Audit Requirements

The following actions should generate audit records whenever practical:

- Enrollment
- Removal from class
- Attendance edits
- Recommendation changes
- Completion approval
- Pastoral overrides

Audit records improve accountability and historical reporting.

---

# Guiding Principle

Permissions should support ministry while protecting data integrity.

Whenever uncertainty exists, prefer a more restrictive default and expand permissions intentionally rather than granting excessive access by default.
