-- Applied manually in SQL Editor on 2026-09-30; recorded here to keep repo = live.
BEGIN;
DROP POLICY IF EXISTS "advisors_self_select" ON advisors;
DROP POLICY IF EXISTS "advisors_self_update" ON advisors;
COMMIT;
