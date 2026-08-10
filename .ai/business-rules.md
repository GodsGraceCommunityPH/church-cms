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

An invite registration checks for exact normalized First Name + Last Name
matches before creating a Member. Normalization trims outer whitespace,
collapses repeated spaces, and compares case-insensitively; it is never fuzzy.
One match requires the registrant to confirm the existing name before that
same Member UUID is updated. A declined match creates a distinct person. More
than one match is preserved in a private staff review queue and is never
automatically connected. Public confirmation reveals only the matched name,
and blank optional submissions never erase existing profile values.

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

Configurable session requirements are tracked separately from the Completion
Checklist. For the current SUYNL and LifeClass rollout, a program may define
multiple named requirements (for example, Manual or Memory Verse). Each item is
recorded independently for each student and session. These progress records do
not affect completion eligibility in this release.

## Training Guides and Enrollment Context

- Cell Group is the persistent member group. Lighthouse is an activity or
  event and is never another name for Cell Group.
- A Guide is distinct from the class Trainer and is scoped to one Training
  enrollment.
- Guide assignment is optional when adding a student to any Training program.
- One Guide may serve multiple students, while each enrollment has at most one
  active Guide at a time.
- Guide reassignment ends the previous assignment and preserves Guide history.
- Guides are informational in this release and receive no special permissions,
  dashboard, or class-roster grouping.
- The student's Cell Group and Cell Leader are snapshotted when the enrollment
  is created. Later member transfers do not rewrite historical Training context.
- Orientation is an ordinary named Training session and needs no special type.
- Future SOL Guide and requirement behavior remains unconfirmed.

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

An unfinished Current Class enrollment selection is a local administrative
draft. Selected members and optional Guide assignments may be restored when the
staff member returns, but no `member_trainings` record exists until they
explicitly confirm enrollment. Drafts never affect the official class roster,
attendance, reporting, or history.

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
sessions remain completed and read-only. A Teacher may correct one student's
historical attendance and configured requirement results without reopening the
session. The correction must include a reason and preserve the previous values,
new values, acting user, timestamp, class, session, and student in the existing
Training workflow audit history. It must not alter any other student's record
or the completed session state.

Before a current session is completed, an unchecked attendance box is a draft
`Not Marked` state, not an Absence. The completion confirmation reports all
Not Marked students, and only the confirmed completion operation records those
students as Absent.

Each Training class owns its roster display order. Teachers may reorder students
within their gender section and may place the Female or Male section first.
Ordering changes affect presentation only and never change enrollment,
attendance, Guide assignments, requirements, or historical records.

The generated week number is the session sequence and remains read-only. Each
session also has an editable lesson name and date. Teachers may edit these
details for the first, current, and future sessions without changing ordering,
attendance, requirements, progress, or class state. Completed session details
remain read-only in the normal Teacher workflow.

---

# Assignments

Assignments exist independently of attendance.

Additional Training requirements use a reusable program-level library with
stable identifiers. A separate assignment links zero, one, or multiple library
requirements to each class session. Student completion is recorded only for
requirements assigned to that enrollment's session; active library entries are
never implicitly applied to every session.

Completed-session assignments are frozen. Removing a requirement from an
editable session or deactivating its library name never deletes historical
progress. Deactivation prevents new assignments while preserving existing
assignments. Corrections to an existing completed-session student result use
the audited Correct Student Record workflow.

If any student progress exists for an editable session assignment, removal is
blocked until that progress is deliberately cleared through the current-session
workflow. Requirement names may be renamed or reactivated without changing
their stable IDs; the current label is used consistently in current and
historical views. Requirement names remain progress-only and do not affect
completion eligibility.

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

Cancelled restoration reuses the original enrollment record. An open Current
Class restores it to Pending Enrollment; an ongoing Current Class restores it
to In Progress. Existing attendance is never fabricated or deleted, and only
attendance belonging to the selected Current Class can satisfy completion.
Workflow changes and completion reopening preserve an immutable audit event.

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

# Equipment and Assets

Equipment records represent church-owned items and may be tracked as either a
single identifiable asset or a quantity of interchangeable items. Individual
assets always have a quantity of one. A custodian is optional and represents
current responsibility only; it is not a borrowing or checkout workflow.

Normal removal is archival, not deletion. Archived items and their maintenance
history remain available for historical reference. Maintenance records capture
lightweight inspection, repair, maintenance, and replacement-part activity;
they do not create procurement, vendor, or Finance transactions.

---

# Events and Registration

An Event registration is participation in one church event. It never creates,
merges, or modifies a Member record. A registration may reference an existing
Member only when a unique email or mobile match is found; otherwise it remains
a guest registration.

Draft events are private. Only published events may accept public registrations.
Capacity, opening, and closing rules are enforced in the database before a
registration is created. Cancelled registrations remain historical but do not
consume capacity. Public visitors can read only safe published-event details
and can never browse Members, registrations, or administrative information.

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
