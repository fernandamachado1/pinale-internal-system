-- Fix: convert legacy entity_type 'LEATHER' to 'MATERIAL' before db:push
-- The LEATHER value was used in legacy schema but no longer exists in movement_entity_type enum.
-- Safe to run multiple times.

UPDATE inventory_movements
SET entity_type = 'MATERIAL'
WHERE entity_type::text = 'LEATHER';
