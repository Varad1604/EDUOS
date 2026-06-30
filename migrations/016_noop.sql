-- Migration 016: intentional sequence placeholder
-- This migration slot was skipped during development (014 → 015 → 017).
-- This noop preserves migration sequence integrity so that any future
-- 016_*.sql file is not inadvertently applied out of order on existing DBs.
-- Do NOT remove this file.
SELECT 1;
