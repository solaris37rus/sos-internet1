function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function sanitize(input, max = 500) {
  return String(input ?? '').trim().slice(0, max);
}

function makeUid() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SOS-${date}-${rand}`;
}

const allowedTariffs = new Map([
  ['personal', { name: 'Личный План Б', price: 399 }],
  ['family', { name: 'Семейный План Б', price: 990 }],
  ['driver', { name: 'Водитель / Курьер', price: 1490 }],
  ['business', { name: 'Бизнес План Б', price: 4990 }]
]);

function requireDb(env) {
  if (!env.SOS_DB) throw new Error('D1 database binding SOS_DB is not configured');
  return env.SOS_DB;
}

function requireAdmin(request, env) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  return Boolean(env.ADMIN_TOKEN && token === env.ADMIN_TOKEN);
}

async function hasColumn(db, table, column) {
  const info = await db.prepare(`PRAGMA table_info(${table})`).all();
  return Boolean((info.results || []).some((row) => row.name === column));
}

async function addColumnIfMissing(db, table, column, definition) {
  if (!(await hasColumn(db, table, column))) {
    await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

async function ensureSchema(db) {
  // Создаём новую структуру, если таблиц ещё нет.
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_uid TEXT,
      tariff_id TEXT,
      tariff_name TEXT,
      amount_rub INTEGER,
      customer_name TEXT,
      customer_contact TEXT,
      customer_city TEXT,
      use_case TEXT,
      comment TEXT,
      status TEXT NOT NULL DEFAULT 'awaiting_payment',
      payment_method TEXT NOT NULL DEFAULT 'sbp_alfa',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  // Если у пользователя уже была старая таблица orders, аккуратно добавляем недостающие поля.
  await addColumnIfMissing(db, 'orders', 'order_uid', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'tariff_id', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'tariff_name', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'amount_rub', 'INTEGER');
  await addColumnIfMissing(db, 'orders', 'customer_city', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'use_case', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'comment', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'payment_method', "TEXT DEFAULT 'sbp_alfa'");
  await addColumnIfMissing(db, 'orders', 'updated_at', 'TEXT');

  // Совместимость со старой схемой, где поля назывались иначе.
  await addColumnIfMissing(db, 'orders', 'order_number', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'plan_id', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'plan_title', 'TEXT');
  await addColumnIfMissing(db, 'orders', 'price', 'INTEGER');
  await addColumnIfMissing(db, 'orders', 'customer_comment', 'TEXT');

  await db.prepare('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)').run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      contact TEXT,
      message TEXT NOT NULL,
      page TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
  await addColumnIfMissing(db, 'feedback', 'page', 'TEXT');
}

async function resetSchema(db) {
  await db.prepare('DROP TABLE IF EXISTS orders').run();
  await db.prepare('DROP TABLE IF EXISTS feedback').run();
  await ensureSchema(db);
}

async function handleOrders(request, env) {
  const db = requireDb(env);
  await ensureSchema(db);

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const tariffId = sanitize(body.tariffId, 50);
    const tariff = allowedTariffs.get(tariffId);
    if (!tariff) return json({ ok: false, error: 'Unknown tariff', received: tariffId }, 400);

    const name = sanitize(body.name, 120);
    const contact = sanitize(body.contact, 160);
    if (!name || !contact) return json({ ok: false, error: 'Name and contact are required' }, 400);

    const orderUid = makeUid();
    const city = sanitize(body.city, 120);
    const useCase = sanitize(body.useCase, 120);
    const comment = sanitize(body.comment, 1000);

    await db.prepare(`
      INSERT INTO orders (
        order_uid, order_number, tariff_id, plan_id, tariff_name, plan_title, amount_rub, price,
        customer_name, customer_contact, customer_city, use_case, comment, customer_comment, status, payment_method, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_payment', 'sbp_alfa', datetime('now'))
    `).bind(
      orderUid, orderUid, tariffId, tariffId, tariff.name, tariff.name, tariff.price, tariff.price,
      name, contact, city, useCase, comment, comment
    ).run();

    return json({ ok: true, orderUid, status: 'awaiting_payment', amountRub: tariff.price, tariffName: tariff.name });
  }

  if (request.method === 'GET') {
    if (!requireAdmin(request, env)) return json({ ok: false, error: 'Unauthorized' }, 401);
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);
    let stmt;
    if (status) {
      stmt = db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY id DESC LIMIT ?').bind(status, limit);
    } else {
      stmt = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT ?').bind(limit);
    }
    const { results } = await stmt.all();
    return json({ ok: true, orders: results || [] });
  }

  if (request.method === 'PATCH') {
    if (!requireAdmin(request, env)) return json({ ok: false, error: 'Unauthorized' }, 401);
    const body = await request.json().catch(() => ({}));
    const orderUid = sanitize(body.orderUid, 80);
    const status = sanitize(body.status, 40);
    const allowed = ['awaiting_payment', 'paid', 'delivered', 'cancelled'];
    if (!orderUid || !allowed.includes(status)) return json({ ok: false, error: 'Invalid status or orderUid' }, 400);
    await db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE order_uid = ?").bind(status, orderUid).run();
    return json({ ok: true });
  }

  return json({ ok: false, error: 'Method not allowed' }, 405);
}

async function handleFeedback(request, env) {
  const db = requireDb(env);
  await ensureSchema(db);
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
  const body = await request.json().catch(() => ({}));
  const message = sanitize(body.message, 1500);
  if (!message) return json({ ok: false, error: 'Message is required' }, 400);
  await db.prepare('INSERT INTO feedback (name, contact, message, page) VALUES (?, ?, ?, ?)')
    .bind(sanitize(body.name, 120), sanitize(body.contact, 160), message, sanitize(body.page, 200)).run();
  return json({ ok: true });
}

async function setupDatabase(request, env) {
  const db = requireDb(env);
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  const confirm = url.searchParams.get('confirm') || '';
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return json({ ok: false, error: 'Unauthorized' }, 401);
  if (confirm !== 'reset') return json({ ok: false, error: 'Add &confirm=reset to initialize database' }, 400);
  await resetSchema(db);
  return json({ ok: true, message: 'Database initialized', tables: ['orders', 'feedback'] });
}

async function debugDb(request, env) {
  if (!requireAdmin(request, env)) return json({ ok: false, error: 'Unauthorized' }, 401);
  const db = requireDb(env);
  await ensureSchema(db);
  const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  const ordersInfo = await db.prepare("PRAGMA table_info(orders)").all();
  return json({ ok: true, hasDb: true, tables: tables.results || [], ordersColumns: ordersInfo.results || [] });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

    try {
      if (url.pathname === '/api/orders') return await handleOrders(request, env);
      if (url.pathname === '/api/feedback') return await handleFeedback(request, env);
      if (url.pathname === '/api/setup-db') return await setupDatabase(request, env);
      if (url.pathname === '/api/debug-db') return await debugDb(request, env);
      if (url.pathname === '/api/health') return json({ ok: true, service: 'sos-internet', build: 'compat-db-v6' });
    } catch (err) {
      return json({ ok: false, error: err.message || 'Server error', stack: String(err.stack || '').slice(0, 800) }, 500);
    }

    return env.ASSETS.fetch(request);
  }
};
