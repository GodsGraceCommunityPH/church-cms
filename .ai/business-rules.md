# Business Rules

This document contains the business rules that govern GGCCC CMS.

Unlike code, these rules describe **why** the application behaves a certain way.

If implementation and this document disagree, review the architecture before changing either.

---

# Core Principle

The purpose of GGCCC CMS is to support discipleship.

Every major feature should ultimately contribute to helping leaders disciple people.

The system is **not** intended to function as a generic CRM.

---

# Training Management System (TMS)

The Training Management System (TMS) is the operational core of GGCCC CMS.

Other modules exist primarily to support the training journey.

Examples:

- Members provide identity.
- Cell Groups provide relationships.
- Ministries provide service opportunities.
- Finance supports administration.
- Events support church activities.

When making architectural decisions, prefer solutions that strengthen the Training module.

---

# Members

## Member Records

A member represents a person who is known by the church.

A member may exist regardless of:

- Cell Group
- Ministry
- Training status

These relationships are optional.

---

## Public Registration

Visitors may register through the public website.

Registration does **not** automatically make someone a church member.

Church leaders determine whether a visitor becomes a member.

---

## Profile Ownership

Members should eventually be able to maintain their own profile.

Administrators retain full editing capabilities.

---

# Cell Groups

Cell Groups represent discipleship relationships.

They are **not** organizational departments.

---

## Membership

A member may belong to zero or one Cell Group.

Multiple Cell Group membership is not supported.

---

## Assignment

Moving a member between Cell Groups should preserve historical records where practical.

Future reporting may require tracking previous assignments.

---

## Deletion

A Cell Group cannot be deleted while members are assigned to it.

The system should require reassignment or removal first.

---

# Training

Training progression is intentionally **not automatic**.

Completing one class does **not** automatically enroll a member into the next.

---

## Completion

Completion is governed by the program's Completion Checklist.

For GGCCC v1, the Completion Checklist contains one requirement:

- Required attendance completed.

Once the checklist is satisfied, the student becomes **Eligible for Completion**.
The normal workflow is attendance completed, eligibility, then Teacher/Admin
completion from the Current Class page. Completion is not available from the
Student Profile and must not occur before the checklist is satisfied.

The checklist model must support future requirements such as a workbook,
interview, or memory verse without a database or workflow redesign.

The portal does not provide an Override Completion action. Exceptional data
repair, if leadership ever requires it, must occur outside the normal Training
workflow through a separate, explicitly audited administrative process.

Completion does **not** imply readiness.

---

## Recommendation

Recommendation is made by the trainer or leader.

A recommendation indicates the member appears ready.

Recommendation does **not** enroll the member.

---

## Enrollment

Enrollment is an administrative decision.

Enrollment may depend on:

- available schedule
- trainer availability
- church leadership
- member readiness

---

## Advancement

Advancement considers more than attendance.

Possible factors include:

- attendance
- assignment completion
- participation
- attitude
- faithfulness
- trainer observations
- pastoral discretion

---

## Pastoral Authority

Pastoral leadership always has authority to override automated recommendations.

The application should support leadership decisions rather than replace them.

---

# Attendance

Attendance records represent participation and are the sole enabled Completion
Checklist requirement for GGCCC v1. Present and Late count toward completion;
Excused attendance is configurable per Current Class; Absent does not count.

Attendance progress is scoped to the enrollment's Current Class. Attendance
from an earlier class or attempt never satisfies a later attempt.

Regular sessions progress sequentially. Only the current released session
accepts normal attendance. A future session is released after every active
student has an attendance value for the preceding session. Completed previous
sessions are read-only unless an Administrator explicitly reopens one for an
audited correction.

---

# Assignments

Assignments exist independently of attendance.

A member may:

- attend but not complete assignments
- complete assignments after class
- require remedial work

---

# Remedials

Remedials are part of the training process.

Completing remedials should update training records without rewriting historical attendance.

An absence remains recorded as Absent. A separately recorded completed
remedial may satisfy that missed session obligation. Adding, correcting, or
reopening attendance or remedial completion must recalculate eligibility in
both directions.

---

## Enrollment State Changes

Training enrollment state changes use dedicated permission-checked operations.
The approved normal transitions are:

- Pending Enrollment to Cancelled
- Cancelled to Pending Enrollment through explicit restoration
- In Progress to Withdrawn
- Completed to In Progress through an Administrator reopen action

Cancelled restoration reuses the enrollment record but does not count
attendance or remedials belonging to its previous class. Workflow changes and
completion reopening preserve an immutable audit event.

---

# Ministries

Ministries are service areas.

Membership in a ministry is independent of:

- Cell Group
- Training completion

Although churches may establish prerequisites, the application should avoid hard-coded assumptions.

---

# Finance

Finance records are administrative.

Financial records should never be deleted once finalized.

Corrections should occur through adjustments rather than destructive edits.

This preserves audit history.

---

# Audit Philosophy

Where practical, historical information should be preserved.

Avoid destructive operations when historical reporting could become inaccurate.

Examples include:

- Cell Group transfers
- Training history
- Ministry history
- Financial records

---

# Permissions

Permissions should follow the principle of least privilege.

Users receive only the access required for their responsibilities.

Administrators have full access.

Future role-based permissions should support:

- Admin
- Pastor
- Trainer
- Cell Leader
- Ministry Leader
- Member

---

# Future Development

When implementing new modules, ask:

1. Does this help disciple people?
2. Does this reduce administrative work?
3. Does this preserve historical accuracy?
4. Does this align with the church's workflow?
5. Does this integrate naturally with the Training Management System?

If the answer is "no" to most of these questions, reconsider the feature before implementation.
