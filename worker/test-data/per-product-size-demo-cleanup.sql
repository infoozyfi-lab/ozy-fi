-- Cleanup for per-product-size-demo.sql — removes both throwaway test
-- products and their own 'size' option groups/options. Run this against
-- the same database you ran the demo script against, once you're done
-- looking at the feature.
--
--   npx wrangler d1 execute ozyfi-db --local --file=./worker/test-data/per-product-size-demo-cleanup.sql

DELETE FROM options WHERE group_id IN ('test-size-a', 'test-size-b');
DELETE FROM option_groups WHERE id IN ('test-size-a', 'test-size-b');
DELETE FROM products WHERE id IN ('TEST-per-product-size-a', 'TEST-per-product-size-b');
