
const FALLBACK_ADMIN_TOKEN = 'sos_admin_2026_super_secret';

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
  ['personal', {
    name: 'Личный План Б',
    price: 399,
    delivery: [
      '20 аварийных сценариев для телефона',
      'чек-лист подготовки к сбоям связи',
      'SMS-шаблоны для семьи и важных контактов',
      'памятка по оплате, картам, банкам и мессенджерам',
      'инструкция по установке PWA на телефон'
    ]
  }],
  ['family', {
    name: 'Семейный План Б',
    price: 990,
    delivery: [
      'всё из личного Плана Б',
      'памятка для родителей крупным и простым языком',
      'семейная кодовая фраза и правила связи',
      'антискам-инструкции: коды, переводы, “безопасный счёт”',
      'PDF/текст для печати и отправки родственникам'
    ]
  }],
  ['driver', {
    name: 'Водитель / Курьер',
    price: 1490,
    delivery: [
      'чек-лист перед сменой',
      'план действий при сбое навигатора',
      'шаблоны сообщений клиенту',
      'план фиксации заказа при плохой связи',
      'инструкция по офлайн-картам и резервным контактам'
    ]
  }],
  ['business', {
    name: 'Бизнес План Б',
    price: 4990,
    delivery: [
      'резервная страница связи',
      'QR-комплект для клиентов',
      'форма заявки',
      'инструкции сотрудникам при сбое связи/оплаты',
      'шаблоны объявлений, сообщений и сценариев оплаты'
    ]
  }]
]);

function getAdminToken(env) {
  return env.ADMIN_TOKEN || FALLBACK_ADMIN_TOKEN;
}

function requireDb(env) {
  if (!env.SOS_DB) throw new Error('D1 database binding SOS_DB is not configured');
  return env.SOS_DB;
}

function requireAdmin(request, env) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  return Boolean(token && token === getAdminToken(env));
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
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_uid TEXT,
      order_number TEXT,
      tariff_id TEXT,
      plan_id TEXT,
      tariff_name TEXT,
      plan_title TEXT,
      amount_rub INTEGER,
      price INTEGER,
      customer_name TEXT,
      customer_contact TEXT,
      customer_city TEXT,
      use_case TEXT,
      comment TEXT,
      customer_comment TEXT,
      status TEXT NOT NULL DEFAULT 'awaiting_payment',
      payment_method TEXT NOT NULL DEFAULT 'sbp_alfa',
      telegram_chat_id TEXT,
      telegram_username TEXT,
      telegram_name TEXT,
      delivery_sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  const columns = [
    ['order_uid','TEXT'], ['order_number','TEXT'], ['tariff_id','TEXT'], ['plan_id','TEXT'],
    ['tariff_name','TEXT'], ['plan_title','TEXT'], ['amount_rub','INTEGER'], ['price','INTEGER'],
    ['customer_name','TEXT'], ['customer_contact','TEXT'], ['customer_city','TEXT'], ['use_case','TEXT'],
    ['comment','TEXT'], ['customer_comment','TEXT'], ['payment_method',"TEXT DEFAULT 'sbp_alfa'"],
    ['telegram_chat_id','TEXT'], ['telegram_username','TEXT'], ['telegram_name','TEXT'],
    ['delivery_sent_at','TEXT'], ['updated_at','TEXT']
  ];
  for (const [column, def] of columns) await addColumnIfMissing(db, 'orders', column, def);

  await db.prepare('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_orders_uid ON orders(order_uid)').run();

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

function normalizeOrder(row) {
  return {
    ...row,
    order_uid: row.order_uid || row.order_number,
    tariff_id: row.tariff_id || row.plan_id,
    tariff_name: row.tariff_name || row.plan_title,
    amount_rub: row.amount_rub || row.price,
    comment: row.comment || row.customer_comment
  };
}

async function telegramApi(env, method, payload) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.description || `Telegram ${method} failed`);
  return data;
}

function buildDeliveryText(order) {
  const normalized = normalizeOrder(order);
  const tariff = allowedTariffs.get(normalized.tariff_id) || {
    name: normalized.tariff_name || 'Цифровой План Б',
    delivery: ['цифровой комплект по выбранному тарифу', 'пошаговые инструкции', 'шаблоны и памятки']
  };

  return [
    `✅ Оплата подтверждена`,
    ``,
    `Заказ: ${normalized.order_uid}`,
    `Тариф: ${tariff.name}`,
    ``,
    `Что входит в ваш комплект:`,
    ...tariff.delivery.map((item) => `• ${item}`),
    ``,
    `Как пользоваться:`,
    `1. Откройте сайт SOS Интернет и добавьте его на главный экран телефона.`,
    `2. Заранее сохраните важные контакты, банки, адреса и SMS-шаблоны.`,
    `3. В момент сбоя откройте раздел “Что случилось?” и действуйте по шагам.`,
    ``,
    `Ваш сайт: https://sos-internet1.slava-plekhanov-2002.workers.dev`,
    ``,
    `Поддержка: https://vk.com/bread1996`,
    `Email: slava.plekhanov.2002@gmail.com`
  ].join('\n');
}

async function sendDeliveryIfPossible(db, env, orderUid) {
  const { results } = await db.prepare('SELECT * FROM orders WHERE order_uid = ? OR order_number = ? ORDER BY id DESC LIMIT 1')
    .bind(orderUid, orderUid).all();
  const order = results?.[0];
  if (!order) return { sent: false, reason: 'order_not_found' };

  const normalized = normalizeOrder(order);
  if (!normalized.telegram_chat_id) return { sent: false, reason: 'telegram_not_connected' };
  if (!env.TELEGRAM_BOT_TOKEN) return { sent: false, reason: 'telegram_token_missing' };

  const text = buildDeliveryText(normalized);
  await telegramApi(env, 'sendMessage', {
    chat_id: normalized.telegram_chat_id,
    text,
    disable_web_page_preview: true
  });

  await db.prepare("UPDATE orders SET delivery_sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
    .bind(order.id).run();

  return { sent: true, chatId: normalized.telegram_chat_id };
}

function getBotLink(env, orderUid = '') {
  const username = sanitize(env.TELEGRAM_BOT_USERNAME, 80).replace(/^@/, '');
  if (!username) return null;
  return orderUid ? `https://t.me/${username}?start=${encodeURIComponent(orderUid)}` : `https://t.me/${username}`;
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

    return json({
      ok: true,
      orderUid,
      status: 'awaiting_payment',
      amountRub: tariff.price,
      tariffName: tariff.name,
      telegramBotLink: getBotLink(env, orderUid)
    });
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
    return json({ ok: true, orders: (results || []).map(normalizeOrder) });
  }

  if (request.method === 'PATCH') {
    if (!requireAdmin(request, env)) return json({ ok: false, error: 'Unauthorized' }, 401);
    const body = await request.json().catch(() => ({}));
    const orderUid = sanitize(body.orderUid, 80);
    const status = sanitize(body.status, 40);
    const allowed = ['awaiting_payment', 'paid', 'delivered', 'cancelled'];
    if (!orderUid || !allowed.includes(status)) return json({ ok: false, error: 'Invalid status or orderUid' }, 400);

    await db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE order_uid = ? OR order_number = ?")
      .bind(status, orderUid, orderUid).run();

    let delivery = { sent: false, reason: 'not_paid_status' };
    if (status === 'paid' || status === 'delivered') {
      delivery = await sendDeliveryIfPossible(db, env, orderUid);
    }

    return json({ ok: true, delivery });
  }

  return json({ ok: false, error: 'Method not allowed' }, 405);
}

async function handleTelegramWebhook(request, env) {
  const db = requireDb(env);
  await ensureSchema(db);

  const update = await request.json().catch(() => ({}));
  const message = update.message || update.edited_message;
  if (!message || !message.chat) return json({ ok: true, ignored: true });

  const chatId = String(message.chat.id);
  const text = sanitize(message.text, 500);
  const from = message.from || {};
  const username = sanitize(from.username, 80);
  const fullName = sanitize([from.first_name, from.last_name].filter(Boolean).join(' '), 160);

  if (text.startsWith('/start')) {
    const parts = text.split(/\s+/);
    const orderUid = sanitize(parts[1], 80);

    if (!orderUid) {
      await telegramApi(env, 'sendMessage', {
        chat_id: chatId,
        text: 'Здравствуйте! Чтобы привязать Telegram к заказу, откройте бота по кнопке на сайте после оформления заказа или отправьте команду /start НОМЕР_ЗАКАЗА.'
      });
      return json({ ok: true });
    }

    const { results } = await db.prepare('SELECT * FROM orders WHERE order_uid = ? OR order_number = ? ORDER BY id DESC LIMIT 1')
      .bind(orderUid, orderUid).all();

    if (!results || !results[0]) {
      await telegramApi(env, 'sendMessage', {
        chat_id: chatId,
        text: `Заказ ${orderUid} не найден. Проверьте номер заказа или напишите в поддержку: https://vk.com/bread1996`,
        disable_web_page_preview: true
      });
      return json({ ok: true, linked: false });
    }

    const order = normalizeOrder(results[0]);
    await db.prepare("UPDATE orders SET telegram_chat_id = ?, telegram_username = ?, telegram_name = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(chatId, username, fullName, results[0].id).run();

    await telegramApi(env, 'sendMessage', {
      chat_id: chatId,
      text: `Telegram привязан к заказу ${order.order_uid}.\nСтатус: ${order.status}.\n\nПосле подтверждения оплаты комплект придёт сюда автоматически.`,
      disable_web_page_preview: true
    });

    if (order.status === 'paid' || order.status === 'delivered') {
      await sendDeliveryIfPossible(db, env, order.order_uid);
    }

    return json({ ok: true, linked: true, orderUid: order.order_uid });
  }

  await telegramApi(env, 'sendMessage', {
    chat_id: chatId,
    text: 'Я бот выдачи заказов SOS Интернет. Для привязки заказа отправьте /start НОМЕР_ЗАКАЗА или нажмите кнопку Telegram после оформления заказа на сайте.'
  });
  return json({ ok: true });
}

async function setTelegramWebhook(request, env) {
  if (!requireAdmin(request, env)) {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') || '';
    if (token !== getAdminToken(env)) return json({ ok: false, error: 'Unauthorized' }, 401);
  }
  if (!env.TELEGRAM_BOT_TOKEN) return json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured' }, 500);

  const webhookUrl = new URL('/api/telegram/webhook', request.url).toString();
  const result = await telegramApi(env, 'setWebhook', {
    url: webhookUrl,
    allowed_updates: ['message', 'edited_message'],
    drop_pending_updates: false
  });
  return json({ ok: true, webhookUrl, telegram: result });
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
  if (token !== getAdminToken(env)) return json({ ok: false, error: 'Unauthorized' }, 401);
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
      if (url.pathname === '/admin') {
        return env.ASSETS.fetch(new Request(new URL('/admin.html', request.url)));
      }
      if (url.pathname === '/api/orders') return await handleOrders(request, env);
      if (url.pathname === '/api/feedback') return await handleFeedback(request, env);
      if (url.pathname === '/api/setup-db') return await setupDatabase(request, env);
      if (url.pathname === '/api/debug-db') return await debugDb(request, env);
      if (url.pathname === '/api/telegram/webhook') return await handleTelegramWebhook(request, env);
      if (url.pathname === '/api/telegram/set-webhook') return await setTelegramWebhook(request, env);
      if (url.pathname === '/api/health') {
        return json({
          ok: true,
          service: 'sos-internet',
          build: 'telegram-auto-delivery-v9',
          adminFallback: true,
          hasConfiguredAdminToken: Boolean(env.ADMIN_TOKEN),
          telegramConfigured: Boolean(env.TELEGRAM_BOT_TOKEN),
          telegramUsername: sanitize(env.TELEGRAM_BOT_USERNAME, 80) || null
        });
      }
    } catch (err) {
      return json({ ok: false, error: err.message || 'Server error', stack: String(err.stack || '').slice(0, 800) }, 500);
    }

    return env.ASSETS.fetch(request);
  }
};
