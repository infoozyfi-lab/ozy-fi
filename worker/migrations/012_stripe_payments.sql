-- Stripe card payments (added alongside the existing 'cod' flow).
--
-- orders.payment_method already existed ('cod' default, worker/schema.sql)
-- — this migration just adds the two columns needed to track a Stripe
-- payment through its lifecycle once payment_method = 'card':
--
--   payment_status:
--     'cod'      — cash on delivery, nothing to track (kept as the
--                   default so every pre-existing row and every future
--                   COD order needs no special-casing elsewhere).
--     'pending'  — a card order was created and a Stripe PaymentIntent
--                   exists for it, but Stripe hasn't confirmed the charge
--                   yet.
--     'paid'     — Stripe confirmed the charge (set by the webhook, the
--                   only source of truth — see app/api/webhooks/stripe).
--     'failed'   — the card was declined / payment did not go through.
--
--   stripe_payment_intent_id: Stripe's own id for the PaymentIntent tied
--     to this order, so the webhook (which only receives Stripe's ids,
--     never our order_num) can look up which order to update.
ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'cod';
ALTER TABLE orders ADD COLUMN stripe_payment_intent_id TEXT;

CREATE INDEX idx_orders_stripe_payment_intent_id ON orders (stripe_payment_intent_id);
