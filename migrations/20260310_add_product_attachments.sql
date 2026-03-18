-- Add attachments array to products table
-- Stores Google Drive share URLs (or any URL) for product photos and PDFs
-- Safe to run multiple times.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS attachments text[] NOT NULL DEFAULT '{}';
