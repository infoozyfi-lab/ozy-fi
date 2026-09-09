// Shared helper for writing to `audit_log` (see worker/schema.sql). Kept
// deliberately tiny and forgiving — a logging failure should never break
// the actual admin action it's describing, so every call site does
// `ctx.waitUntil(logActivity(...))` or awaits it wrapped in its own
// try/catch upstream; this function also never throws on its own.
//
// `detail` is meant to be skimmed by a human in the Activity Log view,
// not replayed or diffed — a short sentence, not a JSON dump of
// before/after state.
export async function logActivity(env, session, action, detail) {
  if (!env || !env.DB || !session) return;

  try {
    await env.DB.prepare(
      `INSERT INTO audit_log (staff_id, staff_name, action, detail) VALUES (?, ?, ?, ?)`
    )
      .bind(
        session.staffId ?? null,
        session.isLegacy ? `${session.name || 'Owner'} (legacy admin login)` : session.name || 'Unknown',
        action,
        detail || null
      )
      .run();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('audit_log write failed:', err);
  }
}
