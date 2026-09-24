-- Priority-fixes brief (roadmap gap analysis), Part 1 — 🔴 security fix.
--
-- `app/api/referral/route.ts` was unauthenticated and had NO rate
-- limiting at all — the route's own header comment already flagged this
-- as a known gap ("nothing stops a script from calling this repeatedly
-- with fake-but-valid-looking emails to mint many single-use coupons").
--
-- Run against the LIVE database with:
--   npx wrangler d1 execute ozyfi-db --remote --file=./worker/migrations/016_referral_rate_limit.sql
--
-- The brief asked to reuse the EXISTING login rate-limiting mechanism/
-- table (`login_attempts`) rather than building a second one — this
-- migration does that, but adds one column to make it safe to share:
-- a `purpose` column ('login' | 'referral') so a burst of referral
-- traffic from one IP can never count against — and lock out — an
-- admin trying to log in from that same IP (a real, not hypothetical,
-- risk for a small business: the owner's login and a customer's phone
-- can easily share one public IP on the restaurant's own WiFi/NAT).
-- Without this column, sharing the raw table would mean the referral
-- endpoint's rate limit and the login endpoint's rate limit are
-- actually the SAME counter, which defeats the purpose of a scoped
-- limit for either feature.
--
-- `DEFAULT 'login'` on the new column means every row written by the
-- existing login/2FA-verify code (before those two routes are updated
-- to pass purpose='login' explicitly, and for any row already in the
-- table from before this migration) is correctly attributed to 'login'
-- with zero data migration needed — purely additive, consistent with
-- every other migration in this project.
ALTER TABLE login_attempts ADD COLUMN purpose TEXT NOT NULL DEFAULT 'login';

-- The old index (ip, attempted_at) still works but no longer matches the
-- shape every query now uses (ip, purpose, attempted_at) as tightly as
-- it could — replaced with a purpose-aware index. SQLite doesn't support
-- ALTER INDEX, so this drops and recreates rather than modifying in
-- place; login_attempts is kept intentionally small by the existing
-- opportunistic daily cleanup, so rebuilding this index is cheap.
DROP INDEX IF EXISTS idx_login_attempts_ip;
CREATE INDEX idx_login_attempts_ip_purpose ON login_attempts(ip, purpose, attempted_at);
