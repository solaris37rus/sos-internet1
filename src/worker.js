function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function sanitize(input, max = 500) {
  return String(input || '').trim().slice(0, max);
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

async function handleOrders(request, env) {
  const db = requireDb(env);

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const tariffId = sanitize(body.tariffId, 50);
    const tariff = allowedTariffs.get(tariffId);
    if (!tariff) return json({ error: 'Unknown tariff' }, 400);

    const name = sanitize(body.name, 120);
    const contact = sanitize(body.contact, 160);
    if (!name || !contact) return json({ error: 'Name and contact are required' }, 400);

    const orderUid = makeUid();
    const city = sanitize(body.city, 120);
    const useCase = sanitize(body.useCase, 120);
    const comment = sanitize(body.comment, 1000);

    await db.prepare(`
      INSERT INTO orders (order_uid, tariff_id, tariff_name, amount_rub, customer_name, customer_contact, customer_city, use_case, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(orderUid, tariffId, tariff.name, tariff.price, name, contact, city, useCase, comment).run();

    return json({ ok: true, orderUid, status: 'awaiting_payment', amountRub: tariff.price, tariffName: tariff.name });
  }

  if (request.method === 'GET') {
    if (!requireAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
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
    if (!requireAdmin(request, env)) return json({ error: 'Unauthorized' }, 401);
    const body = await request.json().catch(() => ({}));
    const orderUid = sanitize(body.orderUid, 80);
    const status = sanitize(body.status, 40);
    const allowed = ['awaiting_payment', 'paid', 'delivered', 'cancelled'];
    if (!orderUid || !allowed.includes(status)) return json({ error: 'Invalid status or orderUid' }, 400);
    await db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE order_uid = ?").bind(status, orderUid).run();
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}

async function handleFeedback(request, env) {
  const db = requireDb(env);
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const body = await request.json().catch(() => ({}));
  const message = sanitize(body.message, 1500);
  if (!message) return json({ error: 'Message is required' }, 400);
  await db.prepare('INSERT INTO feedback (name, contact, message, page) VALUES (?, ?, ?, ?)')
    .bind(sanitize(body.name, 120), sanitize(body.contact, 160), message, sanitize(body.page, 200)).run();
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    try {
      if (url.pathname === '/api/orders') return await handleOrders(request, env);
      if (url.pathname === '/api/feedback') return await handleFeedback(request, env);
      if (url.pathname === '/api/health') return json({ ok: true, service: 'sos-internet' });
    } catch (err) {
      return json({ error: err.message || 'Server error' }, 500);
    }

    return env.ASSETS.fetch(request);
  }
};
