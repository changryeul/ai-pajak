-- Phase B-2 follow-up: Make customer.user_id nullable.
--
-- Originally, customer.user_id was NOT NULL because it was assumed every
-- customer also had an auth.users account (self-signup flow). However,
-- when a tax consultant (JTC or external firm) manages a customer on
-- behalf of an unregistered client, there is no auth.users row.
--
-- This change allows consultants to add customers without requiring them
-- to have a platform login. The customer's user_id remains set when the
-- customer signs up themselves.

ALTER TABLE customer ALTER COLUMN user_id DROP NOT NULL;

-- The `unique_customer_user` UNIQUE (user_id) constraint still prevents
-- duplicate links once a user_id is set, but NULL values are allowed
-- (Postgres UNIQUE allows multiple NULLs by default).

COMMENT ON COLUMN customer.user_id IS
  'auth.users FK — nullable. Set when the customer self-signs up; NULL when the customer is managed exclusively by a tax consultant on their behalf.';
