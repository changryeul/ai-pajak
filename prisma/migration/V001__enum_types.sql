-- V001__enum_types.sql
CREATE TYPE user_role AS ENUM ('accountant','consultant','cfo','ceo','admin');
CREATE TYPE plan_type AS ENUM ('free','sme','enterprise');
CREATE TYPE tax_type AS ENUM ('PPh21','PPh23','VAT','ANNUAL');
CREATE TYPE workflow_stage AS ENUM ('UPLOADED','AI_ANALYZED','HUMAN_REVIEW','APPROVED','FILED');
CREATE TYPE filing_status AS ENUM ('DRAFT','SUBMITTED','ACCEPTED','REJECTED');
CREATE TYPE payment_status AS ENUM ('pending','paid','failed');
CREATE TYPE sender_type AS ENUM ('human','ai');