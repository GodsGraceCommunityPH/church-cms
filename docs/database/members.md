# Members Database

# Status

🚧 Planned

---

# Purpose

This document defines the data model for church members.

The Member is the central business entity of GGCCC CMS.

Most modules—including Training, Cell Groups, Ministries, Finance, and Attendance—reference Members.

---

# Design Philosophy

A Member represents a person recognized by the church.

A Member may participate in many different areas of church life.

These relationships should remain independent.

For example, a Member may:

- belong to a Cell Group
- serve in one or more Ministries
- enroll in Training
- have User account access

None of these should be required for the Member record to exist.

---

# Primary Table

## members

Stores the official record of each church member.

Suggested columns:

| Column        | Description                             |
| ------------- | --------------------------------------- |
| id            | UUID primary key                        |
| member_number | Human-friendly identifier (optional)    |
| first_name    | Given name                              |
| middle_name   | Middle name (optional)                  |
| last_name     | Family name                             |
| suffix        | Jr., Sr., III (optional)                |
| sex           | Male / Female                           |
| birth_date    | Date of birth                           |
| civil_status  | Single, Married, etc.                   |
| email         | Optional                                |
| mobile_number | Optional                                |
| address       | Home address                            |
| date_joined   | Official membership date                |
| status        | Active, Inactive, Transferred, Deceased |
| notes         | General remarks                         |
| created_at    | Timestamp                               |
| updated_at    | Timestamp                               |

---

# Member Status

Recommended values:

- Active
- Inactive
- Transferred
- Deceased

Avoid deleting Members.

Status should describe their relationship with the church.

---

# Relationships

A Member may have:

- one current Cell Group
- many Training Enrollments
- many Ministry Assignments
- many Finance Records
- one User Account (optional)
- many Audit Records

---

# Member Number

The Member Number should be stable.

It should never change after assignment.

It should not expose database IDs.

Example formats:

```
GG000001

GG000002

GG000003
```

The exact format may be finalized later.

---

# Contact Information

Contact information may change.

Historical reporting should not depend on old contact information.

Only the current values need to be stored.

---

# Notes

General notes should be administrative only.

Examples:

- prefers phone contact
- emergency contact updated

Sensitive pastoral notes should not be stored in this table.

---

# Soft Delete

Members should not be deleted.

Instead:

- Active → Inactive
- Active → Transferred
- Active → Deceased

Historical relationships must remain intact.

---

# Future Expansion

Possible future relationships:

- Family Members
- Baptism Records
- Child Dedication
- Wedding Records
- Membership Class
- Volunteer History

These should be implemented as separate tables rather than additional columns whenever practical.

---

# Guiding Principle

The Member table should identify a person.

It should not become a catch-all table for every piece of church information.
