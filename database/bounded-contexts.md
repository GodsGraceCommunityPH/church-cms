# Bounded Contexts

# Status

🚧 Active

---

# Purpose

This document defines ownership of business data within GGCCC CMS.

Every piece of information should have exactly one owning module.

Other modules reference that data rather than duplicate it.

---

# Why This Matters

As the application grows, multiple modules will need information about the same Member.

For example:

- Training needs Member names.
- Finance needs Member names.
- Ministries need Member names.

Only one module should own Member information.

Everything else references it.

---

# Core Contexts

## Members

Owner of:

- Personal Information
- Contact Information
- Membership Status
- Family Information (future)
- Member Number

Examples

✓ First Name

✓ Last Name

✓ Birthday

✓ Address

✓ Mobile Number

✓ Membership Status

Not owned:

- Training
- Attendance
- Ministries
- Finance

---

## Cell Groups

Owner of:

- Cell Group Information
- Cell Group Leadership
- Cell Group Membership History

Examples

- Cell Group Name
- Leader
- Meeting Schedule
- Member Transfers

Not owned:

- Personal Information

---

## Training

Owner of:

- Programs
- Classes
- Enrollments
- Attendance
- Assignments
- Recommendations
- Completion

Training references Members.

Training does not own Members.

---

## Ministries

Owner of:

- Ministries
- Ministry Assignments
- Ministry Leadership

Examples

- Music Team
- Technical Team
- Ushering
- Kids Ministry

Ministries reference Members.

---

## Finance

Owner of:

- Offerings
- Tithes
- Expenses
- Financial Reports

Finance references Members.

Finance does not store Member information.

---

## Authentication

Owner of:

- User Accounts
- Passwords
- Login Sessions
- Roles
- Permissions

Authentication references Members when applicable.

---

# Ownership Rules

## Members Own Identity

Never duplicate:

- Name
- Birthday
- Contact Information

Instead

```
member_id
```

---

## Training Owns Training

Training determines:

- Enrollment
- Attendance
- Completion

No other module should modify Training records directly.

---

## Finance Owns Financial Records

Only the Finance module should create or modify financial transactions.

Other modules may read financial information if authorized.

---

## Ministries Own Service Records

Only the Ministries module should manage ministry assignments.

---

# Cross-Module Communication

Modules communicate through foreign keys.

Example

```
Training

↓

member_id

↓

Members
```

Not

```
Training

↓

first_name

last_name

mobile_number
```

---

# Future Contexts

Future modules may include:

- Events
- Prayer Requests
- Counseling
- Asset Management
- Visitor Follow-up
- Communications

Each should define clear ownership before implementation.

---

# Benefits

This approach provides:

- Less duplicated data
- Easier maintenance
- Better reporting
- Clear responsibilities
- Simpler testing
- Reduced bugs

---

# Guiding Principle

Every piece of business information should have exactly one owner.

Other modules reference that owner rather than storing duplicate data.
