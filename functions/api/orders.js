function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function sanitize(input, max = 500) {
  return String(input || '').trim().slice(0, max);
}

function makeUid() {
  const now = new Date();
  const date = now.toISOString().slice(0,10).replaceAll('-', '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SOS-${date}-${rand}`;
}

const allowedTariffs = new Map([
  ['personal', { name: 'Личный План Б', price: 399 }],
  ['family', { name: 'Семейный План Б', price: 990 }],
  ['driver', { name: 'Водитель / Курьер', price: 1490 }],
  ['business', { name: 'Бизнес План Б', price: 4990 }]
]);

export async function onRequestPost({ request, env }) {
  try {
    if (!env.SOS_DB) return json({ error: 'D1 database binding SOS_DB is not configured' }, 500);
    const body = await request.json();
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

    await env.SOS_DB.prepare(`
      INSERT INTO orders (order_uid, tariff_id, tariff_name, amount_rub, customer_name, customer_contact, customer_city, use_case, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(orderUid, tariffId, tariff.name, tariff.price, name, contact, city, useCase, comment).run();

    return json({ ok: true, orderUid, status: 'awaiting_payment', amountRub: tariff.price, tariffName: tariff.name });
  } catch (err) {
    return json({ error: 'Order creation failed' }, 500);
  }
}

export async function onRequestGet({ request, env }) {
  try {
    if (!env.SOS_DB) return json({ error: 'D1 database binding SOS_DB is not configured' }, 500);
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
    if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return json({ error: 'Unauthorized' }, 401);
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);
    let stmt;
    if (status) {
      stmt = env.SOS_DB.prepare('SELECT * FROM orders WHERE status = ? ORDER BY id DESC LIMIT ?').bind(status, limit);
    } else {
      stmt = env.SOS_DB.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT ?').bind(limit);
    }
    const { results } = await stmt.all();
    return json({ ok: true, orders: results || [] });
  } catch (err) {
    return json({ error: 'Could not load orders' }, 500);
  }
}

export async function onRequestPatch({ request, env }) {
  try {
    if (!env.SOS_DB) return json({ error: 'D1 database binding SOS_DB is not configured' }, 500);
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
    if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return json({ error: 'Unauthorized' }, 401);
    const body = await request.json();
    const orderUid = sanitize(body.orderUid, 80);
    const status = sanitize(body.status, 40);
    const allowed = ['awaiting_payment', 'paid', 'delivered', 'cancelled'];
    if (!orderUid || !allowed.includes(status)) return json({ error: 'Invalid status or orderUid' }, 400);
    await env.SOS_DB.prepare('UPDATE orders SET status = ?, updated_at = datetime(\'now\') WHERE order_uid = ?').bind(status, orderUid).run();
    return json({ ok: true });
  } catch (err) {
    return json({ error: 'Could not update order' }, 500);
  }
}
