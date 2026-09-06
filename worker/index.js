// ozy.fi backend Worker.
// Serves the static Next.js export for normal pages, and handles every
// /api/* route backed by D1.

const ADMIN_TABLES = {
  categories: { cols: ['id', 'title', 'sub', 'image', 'sort_order'] },
  products: {
    cols: [
      'id', 'category_id', 'name', 'description', 'price', 'offer_price',
      'image', 'tag', 'has_toppings', 'sort_order', 'active',
    ],
  },
  option_groups: { cols: ['id', 'title', 'kind', 'icon', 'sort_order'] },
  options: { cols: ['id', 'group_id', 'label', 'price_delta', 'color', 'sort_order'] },
  addons: { cols: ['id', 'type', 'name', 'price', 'image', 'active', 'sort_order'] },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  });
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/* -------------------------------------------------------
   ADMIN AUTH
------------------------------------------------------- */

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(str) {
  const base64 = str
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);

  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function getAdminSecretKey(env) {
  const secret = `${env.ADMIN_EMAIL}:${env.ADMIN_PASSWORD}`;

  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign', 'verify']
  );
}

async function createAdminToken(env) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `ozy-admin:${timestamp}`;

  const key = await getAdminSecretKey(env);

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload)
  );

  return `${bytesToBase64Url(new TextEncoder().encode(payload))}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function isAdmin(request, env) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ')
    ? auth.slice(7)
    : '';

  if (!token) return false;

  const parts = token.split('.');

  if (parts.length !== 2) return false;

  try {
    const payload = new TextDecoder().decode(
      base64UrlToBytes(parts[0])
    );

    const [prefix, timestamp] = payload.split(':');

    if (prefix !== 'ozy-admin') return false;

    const tokenTime = Number(timestamp);

    if (!Number.isFinite(tokenTime)) return false;

    const now = Math.floor(Date.now() / 1000);

    // Token valid for 24 hours.
    if (now - tokenTime < 0 || now - tokenTime > 86400) {
      return false;
    }

    const key = await getAdminSecretKey(env);

    const signature = base64UrlToBytes(parts[1]);

    return await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      new TextEncoder().encode(payload)
    );
  } catch {
    return false;
  }
}

function requireAdmin(handler) {
  return async (request, env, ctx, params) => {
    if (!(await isAdmin(request, env))) {
      return json(
        { error: 'Unauthorized' },
        401
      );
    }

    return handler(request, env, ctx, params);
  };
}

/* -------------------------------------------------------
   PUBLIC: MENU
------------------------------------------------------- */

async function getMenu(request, env) {
  const [
    categories,
    products,
    groups,
    options,
    addons,
    settingsRows,
  ] = await Promise.all([
    env.DB.prepare(
      'SELECT * FROM categories ORDER BY sort_order'
    ).all(),

    env.DB.prepare(
      'SELECT * FROM products WHERE active = 1 ORDER BY sort_order'
    ).all(),

    env.DB.prepare(
      'SELECT * FROM option_groups ORDER BY sort_order'
    ).all(),

    env.DB.prepare(
      'SELECT * FROM options ORDER BY sort_order'
    ).all(),

    env.DB.prepare(
      'SELECT * FROM addons WHERE active = 1 ORDER BY sort_order'
    ).all(),

    // Only pricing constants live in this table (never secrets — the
    // admin login is checked against Cloudflare Secrets, not this
    // table), so it's safe to expose here for the storefront to price
    // orders (e.g. the large-size upcharge).
    env.DB.prepare(
      'SELECT key, value FROM admin_settings'
    ).all(),
  ]);

  const optionsByGroup = {};

  for (const o of options.results) {
    (optionsByGroup[o.group_id] ||= []).push(o);
  }

  const optionGroups = groups.results.map((g) => ({
    ...g,
    options: optionsByGroup[g.id] || [],
  }));

  const settings = {};

  for (const row of settingsRows.results) {
    settings[row.key] = row.value;
  }

  return json({
    categories: categories.results,
    products: products.results,
    optionGroups,
    addons: addons.results,
    settings,
  });
}

/* -------------------------------------------------------
   PUBLIC: ORDERS
------------------------------------------------------- */

function makeOrderNum() {
  const n = Math.floor(1000 + Math.random() * 9000);

  return `OZY-${Date.now()
    .toString(36)
    .toUpperCase()
    .slice(-4)}${n}`;
}

async function createOrder(request, env) {
  const body = await request
    .json()
    .catch(() => null);

  if (
    !body ||
    !body.customer ||
    !Array.isArray(body.items) ||
    body.items.length === 0
  ) {
    return json(
      { error: 'Invalid order payload' },
      400
    );
  }

  const {
    customer,
    items,
    total,
  } = body;

  if (
    !customer.name ||
    !customer.address ||
    !customer.email ||
    !customer.phone
  ) {
    return json(
      { error: 'Missing customer details' },
      400
    );
  }

  const orderNum = makeOrderNum();

  const insertOrder = await env.DB.prepare(
    `INSERT INTO orders
      (
        order_num,
        customer_name,
        address,
        email,
        phone,
        notes,
        total,
        status,
        payment_method
      )
     VALUES
      (?, ?, ?, ?, ?, ?, ?, 'received', 'cod')`
  )
    .bind(
      orderNum,
      customer.name,
      customer.address,
      customer.email,
      customer.phone,
      customer.notes || '',
      total
    )
    .run();

  const orderId = insertOrder.meta.last_row_id;

  const stmts = items.map((line) =>
    env.DB.prepare(
      `INSERT INTO order_items
        (
          order_id,
          product_id,
          name,
          qty,
          line_total,
          details
        )
       VALUES
        (?, ?, ?, ?, ?, ?)`
    ).bind(
      orderId,
      line.productId || null,
      line.name,
      line.qty,
      line.lineTotal,
      JSON.stringify(line.details || [])
    )
  );

  if (stmts.length) {
    await env.DB.batch(stmts);
  }

  return json(
    {
      orderNum,
      id: orderId,
      status: 'received',
    },
    201
  );
}

async function trackOrder(
  request,
  env,
  ctx,
  params
) {
  const order = await env.DB.prepare(
    'SELECT * FROM orders WHERE order_num = ?'
  )
    .bind(params.orderNum)
    .first();

  if (!order) {
    return json(
      { error: 'Order not found' },
      404
    );
  }

  const items = await env.DB.prepare(
    'SELECT * FROM order_items WHERE order_id = ?'
  )
    .bind(order.id)
    .all();

  return json({
    ...order,
    items: items.results,
  });
}

/* -------------------------------------------------------
   ADMIN: LOGIN
------------------------------------------------------- */

async function adminLogin(request, env) {
  const body = await request
    .json()
    .catch(() => ({}));

  const email = String(body.email || '').trim();
  const password = String(body.password || '');

  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    return json(
      {
        error: 'Admin authentication is not configured',
      },
      500
    );
  }

  if (
    email !== env.ADMIN_EMAIL ||
    password !== env.ADMIN_PASSWORD
  ) {
    return json(
      { error: 'Invalid email or password' },
      401
    );
  }

  const token = await createAdminToken(env);

  return json({
    token,
    email: env.ADMIN_EMAIL,
  });
}

/* -------------------------------------------------------
   ADMIN: GENERIC CRUD
------------------------------------------------------- */

async function adminList(
  request,
  env,
  ctx,
  params
) {
  const table = ADMIN_TABLES[params.table];

  if (!table) {
    return json(
      { error: 'Unknown table' },
      404
    );
  }

  const rows = await env.DB.prepare(
    `SELECT * FROM ${params.table} ORDER BY sort_order`
  ).all();

  return json(rows.results);
}

async function adminCreate(
  request,
  env,
  ctx,
  params
) {
  const table = ADMIN_TABLES[params.table];

  if (!table) {
    return json(
      { error: 'Unknown table' },
      404
    );
  }

  const body = await request
    .json()
    .catch(() => ({}));

  if (!body.id && body.name) {
    body.id = `${slugify(body.name)}-${Date.now()
      .toString(36)
      .slice(-4)}`;
  }

  if (!body.id && body.label) {
    body.id = `${slugify(body.label)}-${Date.now()
      .toString(36)
      .slice(-4)}`;
  }

  if (!body.id) {
    return json(
      {
        error: 'id (or name/label) required',
      },
      400
    );
  }

  const cols = table.cols.filter(
    (c) => c in body
  );

  const placeholders = cols
    .map(() => '?')
    .join(', ');

  const values = cols.map(
    (c) => body[c]
  );

  await env.DB.prepare(
    `INSERT INTO ${params.table}
      (${cols.join(', ')})
     VALUES
      (${placeholders})`
  )
    .bind(...values)
    .run();

  return json(
    {
      ok: true,
      id: body.id,
    },
    201
  );
}

async function adminUpdate(
  request,
  env,
  ctx,
  params
) {
  const table = ADMIN_TABLES[params.table];

  if (!table) {
    return json(
      { error: 'Unknown table' },
      404
    );
  }

  const body = await request
    .json()
    .catch(() => ({}));

  const cols = table.cols.filter(
    (c) => c in body && c !== 'id'
  );

  if (!cols.length) {
    return json(
      { error: 'Nothing to update' },
      400
    );
  }

  const setClause = cols
    .map((c) => `${c} = ?`)
    .join(', ');

  const values = cols.map(
    (c) => body[c]
  );

  await env.DB.prepare(
    `UPDATE ${params.table}
     SET ${setClause}
     WHERE id = ?`
  )
    .bind(
      ...values,
      params.id
    )
    .run();

  return json({ ok: true });
}

async function adminDelete(
  request,
  env,
  ctx,
  params
) {
  const table = ADMIN_TABLES[params.table];

  if (!table) {
    return json(
      { error: 'Unknown table' },
      404
    );
  }

  await env.DB.prepare(
    `DELETE FROM ${params.table} WHERE id = ?`
  )
    .bind(params.id)
    .run();

  return json({ ok: true });
}

/* -------------------------------------------------------
   ADMIN: ORDERS
------------------------------------------------------- */

async function adminListOrders(request, env) {
  const url = new URL(request.url);

  const status = url.searchParams.get(
    'status'
  );

  const rows = status
    ? await env.DB.prepare(
        'SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC'
      )
        .bind(status)
        .all()
    : await env.DB.prepare(
        'SELECT * FROM orders ORDER BY created_at DESC'
      ).all();

  return json(rows.results);
}

async function adminOrderDetail(
  request,
  env,
  ctx,
  params
) {
  const order = await env.DB.prepare(
    'SELECT * FROM orders WHERE id = ?'
  )
    .bind(params.id)
    .first();

  if (!order) {
    return json(
      { error: 'Not found' },
      404
    );
  }

  const items = await env.DB.prepare(
    'SELECT * FROM order_items WHERE order_id = ?'
  )
    .bind(params.id)
    .all();

  return json({
    ...order,
    items: items.results,
  });
}

async function adminUpdateOrderStatus(
  request,
  env,
  ctx,
  params
) {
  const body = await request
    .json()
    .catch(() => ({}));

  const allowed = [
    'received',
    'preparing',
    'on_the_way',
    'delivered',
    'cancelled',
  ];

  if (!allowed.includes(body.status)) {
    return json(
      { error: 'Invalid status' },
      400
    );
  }

  await env.DB.prepare(
    'UPDATE orders SET status = ? WHERE id = ?'
  )
    .bind(
      body.status,
      params.id
    )
    .run();

  return json({ ok: true });
}

/* -------------------------------------------------------
   ADMIN: SETTINGS
------------------------------------------------------- */

async function adminGetSettings(
  request,
  env
) {
  const rows = await env.DB.prepare(
    'SELECT key, value FROM admin_settings'
  ).all();

  const out = {};

  for (const r of rows.results) {
    out[r.key] = r.value;
  }

  // Never expose admin password.
  delete out.admin_password;

  return json(out);
}

async function adminUpdateSettings(
  request,
  env
) {
  const body = await request
    .json()
    .catch(() => ({}));

  // Prevent changing authentication secrets
  // through the database settings endpoint.
  delete body.admin_password;
  delete body.ADMIN_PASSWORD;
  delete body.ADMIN_EMAIL;

  const stmts = Object.entries(body).map(
    ([key, value]) =>
      env.DB.prepare(
        `INSERT INTO admin_settings
          (key, value)
         VALUES
          (?, ?)
         ON CONFLICT(key)
         DO UPDATE SET
          value = excluded.value`
      ).bind(
        key,
        String(value)
      )
  );

  if (stmts.length) {
    await env.DB.batch(stmts);
  }

  return json({ ok: true });
}

async function adminChangePassword(
  request,
  env
) {
  return json(
    {
      error:
        'Admin password is managed through Cloudflare Secrets.',
    },
    403
  );
}

/* -------------------------------------------------------
   ROUTER
------------------------------------------------------- */

const routes = [
  ['GET', /^\/api\/menu$/, getMenu],

  ['POST', /^\/api\/orders$/, createOrder],

  [
    'GET',
    /^\/api\/orders\/(?<orderNum>[^/]+)$/,
    trackOrder,
  ],

  ['POST', /^\/api\/admin\/login$/, adminLogin],

  [
    'GET',
    /^\/api\/admin\/settings$/,
    requireAdmin(adminGetSettings),
  ],

  [
    'PUT',
    /^\/api\/admin\/settings$/,
    requireAdmin(adminUpdateSettings),
  ],

  [
    'POST',
    /^\/api\/admin\/change-password$/,
    requireAdmin(adminChangePassword),
  ],

  [
    'GET',
    /^\/api\/admin\/orders$/,
    requireAdmin(adminListOrders),
  ],

  [
    'GET',
    /^\/api\/admin\/orders\/(?<id>\d+)$/,
    requireAdmin(adminOrderDetail),
  ],

  [
    'PATCH',
    /^\/api\/admin\/orders\/(?<id>\d+)$/,
    requireAdmin(adminUpdateOrderStatus),
  ],

  [
    'GET',
    /^\/api\/admin\/(?<table>[a-z_]+)$/,
    requireAdmin(adminList),
  ],

  [
    'POST',
    /^\/api\/admin\/(?<table>[a-z_]+)$/,
    requireAdmin(adminCreate),
  ],

  [
    'PUT',
    /^\/api\/admin\/(?<table>[a-z_]+)\/(?<id>[^/]+)$/,
    requireAdmin(adminUpdate),
  ],

  [
    'DELETE',
    /^\/api\/admin\/(?<table>[a-z_]+)\/(?<id>[^/]+)$/,
    requireAdmin(adminDelete),
  ],
];

export default {
  async fetch(
    request,
    env,
    ctx
  ) {
    const url = new URL(
      request.url
    );

    if (
      url.pathname.startsWith('/api/')
    ) {
      for (
        const [
          method,
          pattern,
          handler,
        ] of routes
      ) {
        if (
          request.method !== method
        ) {
          continue;
        }

        const match =
          url.pathname.match(
            pattern
          );

        if (match) {
          try {
            return await handler(
              request,
              env,
              ctx,
              match.groups || {}
            );
          } catch (err) {
            return json(
              {
                error:
                  'Server error',
                detail:
                  String(err),
              },
              500
            );
          }
        }
      }

      return json(
        { error: 'Not found' },
        404
      );
    }

    // Not an API route — serve the static Next.js export.
    return env.ASSETS.fetch(
      request
    );
  },
};
