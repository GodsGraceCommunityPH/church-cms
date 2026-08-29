-- =====================================================
-- 001_create_members.sql
-- GGCCC CMS
-- Members Table
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    member_number TEXT UNIQUE,

    first_name TEXT NOT NULL,
    middle_name TEXT,
    last_name TEXT NOT NULL,
    suffix TEXT,

    sex TEXT NOT NULL,

    birth_date DATE,

    civil_status TEXT,

    email TEXT,
    mobile_number TEXT,

    address TEXT,

    date_joined DATE,

    status TEXT NOT NULL DEFAULT 'active',

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_member_status
        CHECK (
            status IN (
                'active',
                'inactive',
                'transferred',
                'deceased'
            )
        ),

    CONSTRAINT chk_member_sex
        CHECK (
            sex IN (
                'Male',
                'Female'
            )
        )
);

CREATE INDEX idx_members_last_name
ON members(last_name);

CREATE INDEX idx_members_status
ON members(status);

CREATE INDEX idx_members_member_number
ON members(member_number);

CREATE INDEX idx_members_email
ON members(email);