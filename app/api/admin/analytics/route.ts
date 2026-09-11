import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '@/lib/api-helpers';
import { requireRole } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// One conditional-aggregation pass over `orders` for every headline KPI +
// period-over-period comparison the dashboard needs (today vs yesterday,
// last 7 days vs the 7 before that, last 30 days vs the 30 before that).
async function loadSummary(env: any) {
  // A bare aggregate SELECT with no GROUP BY always returns exactly one row
  // (SUM/COUNT return 0/NULL, never zero rows) — the non-null assertion
  // below reflects that guarantee rather than changing behavior.
  const row = (await env.DB.prepare(
    `SELECT
      SUM(CASE WHEN date(created_at) = date('now') AND status != 'cancelled' THEN total ELSE 0 END) AS today_revenue,
      SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) AS today_orders,
      SUM(CASE WHEN date(created_at) = date('now','-1 day') AND status != 'cancelled' THEN total ELSE 0 END) AS yesterday_revenue,
      SUM(CASE WHEN date(created_at) = date('now','-1 day') THEN 1 ELSE 0 END) AS yesterday_orders,
      SUM(CASE WHEN created_at >= datetime('now','-7 days') AND status != 'cancelled' THEN total ELSE 0 END) AS last7_revenue,
      SUM(CASE WHEN created_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS last7_orders,
      SUM(CASE WHEN created_at >= datetime('now','-14 days') AND created_at < datetime('now','-7 days') AND status != 'cancelled' THEN total ELSE 0 END) AS prev7_revenue,
      SUM(CASE WHEN created_at >= datetime('now','-14 days') AND created_at < datetime('now','-7 days') THEN 1 ELSE 0 END) AS prev7_orders,
      SUM(CASE WHEN created_at >= datetime('now','-30 days') AND status != 'cancelled' THEN total ELSE 0 END) AS last30_revenue,
      SUM(CASE WHEN created_at >= datetime('now','-30 days') THEN 1 ELSE 0 END) AS last30_orders,
      SUM(CASE WHEN created_at >= datetime('now','-60 days') AND created_at < datetime('now','-30 days') AND status != 'cancelled' THEN total ELSE 0 END) AS prev30_revenue,
      SUM(CASE WHEN created_at >= datetime('now','-60 days') AND created_at < datetime('now','-30 days') THEN 1 ELSE 0 END) AS prev30_orders,
      SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END) AS total_revenue,
      COUNT(*) AS total_orders,
      SUM(CASE WHEN status IN ('received','preparing','on_the_way') THEN 1 ELSE 0 END) AS pending_orders,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS completed_orders,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders
    FROM orders`
  ).first<Record<string, unknown>>())!;

  const n = (v: unknown) => Number(v || 0);

  return {
    today: { revenue: n(row.today_revenue), orders: n(row.today_orders) },
    yesterday: { revenue: n(row.yesterday_revenue), orders: n(row.yesterday_orders) },
    last7Days: { revenue: n(row.last7_revenue), orders: n(row.last7_orders) },
    prev7Days: { revenue: n(row.prev7_revenue), orders: n(row.prev7_orders) },
    last30Days: { revenue: n(row.last30_revenue), orders: n(row.last30_orders) },
    prev30Days: { revenue: n(row.prev30_revenue), orders: n(row.prev30_orders) },
    totalRevenue: n(row.total_revenue),
    totalOrders: n(row.total_orders),
    avgOrderValue: n(row.total_orders) ? n(row.total_revenue) / n(row.total_orders) : 0,
    pendingOrders: n(row.pending_orders),
    completedOrders: n(row.completed_orders),
    cancelledOrders: n(row.cancelled_orders),
  };
}

// Powers the Overview/Dashboard KPI tiles and the Reports tab — both
// Manager and Owner territory; Kitchen only ever sees the Orders board.
export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await requireRole(request, env, ['manager', 'owner']);
  if (denied) return denied;

  const [summary, revenueByDayRows, bestSellersRows, todayBestSellersRows, categoryRows, statusRows, hourlyRows] = await Promise.all([
    loadSummary(env),

    env.DB.prepare(
      `SELECT date(created_at) AS day,
              SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END) AS revenue,
              COUNT(*) AS orders
       FROM orders
       WHERE created_at >= datetime('now','-30 days')
       GROUP BY day
       ORDER BY day ASC`
    ).all(),

    env.DB.prepare(
      `SELECT oi.name AS name, SUM(oi.qty) AS qty, SUM(oi.line_total) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.status != 'cancelled'
       GROUP BY oi.name
       ORDER BY qty DESC
       LIMIT 8`
    ).all(),

    env.DB.prepare(
      `SELECT oi.name AS name, SUM(oi.qty) AS qty, SUM(oi.line_total) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.status != 'cancelled' AND date(o.created_at) = date('now')
       GROUP BY oi.name
       ORDER BY qty DESC
       LIMIT 5`
    ).all(),

    env.DB.prepare(
      `SELECT COALESCE(c.title, 'Other') AS category,
              SUM(oi.line_total) AS revenue,
              SUM(oi.qty) AS qty
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE o.status != 'cancelled'
       GROUP BY category
       ORDER BY revenue DESC`
    ).all(),

    env.DB.prepare(
      `SELECT status, COUNT(*) AS count
       FROM orders
       WHERE created_at >= datetime('now','-30 days')
       GROUP BY status`
    ).all(),

    env.DB.prepare(
      `SELECT CAST(strftime('%H', created_at) AS INTEGER) AS hour, COUNT(*) AS count
       FROM orders
       WHERE created_at >= datetime('now','-30 days')
       GROUP BY hour
       ORDER BY hour ASC`
    ).all(),
  ]);

  const todayStatusRow = await env.DB.prepare(
    `SELECT status, COUNT(*) AS count FROM orders WHERE date(created_at) = date('now') GROUP BY status`
  ).all();

  return json({
    summary,
    revenueByDay: revenueByDayRows.results.map((r: any) => ({ day: r.day, revenue: Number(r.revenue || 0), orders: Number(r.orders || 0) })),
    bestSellers: bestSellersRows.results.map((r: any) => ({ name: r.name, qty: Number(r.qty || 0), revenue: Number(r.revenue || 0) })),
    todayBestSellers: todayBestSellersRows.results.map((r: any) => ({ name: r.name, qty: Number(r.qty || 0), revenue: Number(r.revenue || 0) })),
    todayStatusBreakdown: todayStatusRow.results.map((r: any) => ({ status: r.status, count: Number(r.count || 0) })),
    categoryBreakdown: categoryRows.results.map((r: any) => ({ category: r.category, revenue: Number(r.revenue || 0), qty: Number(r.qty || 0) })),
    statusBreakdown: statusRows.results.map((r: any) => ({ status: r.status, count: Number(r.count || 0) })),
    hourlyDistribution: hourlyRows.results.map((r: any) => ({ hour: Number(r.hour), count: Number(r.count || 0) })),
  });
}
