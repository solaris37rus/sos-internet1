const VERSION = 'workers-clean-v11';
const FALLBACK_ADMIN_TOKEN = 'sos_admin_2026_super_secret';

const TARIFFS = {
  personal: {
    name: 'Личный План Б',
    price: 399,
    short: 'Для телефона, связи, банков, карт и оплаты.',
    delivery: [
      '20 аварийных сценариев: интернет, банк, карты, мессенджеры, оплата',
      'чек-лист подготовки телефона к сбоям',
      'SMS-шаблоны для семьи, клиентов и важных контактов',
      'инструкция по установке PWA на главный экран',
      'памятка “что делать, если работает только часть сайтов”'
    ]
  },
  family: {
    name: 'Семейный План Б',
    price: 990,
    short: 'Для родителей, детей и пожилых родственников.',
    delivery: [
      'всё из личного Плана Б',
      'крупная памятка для родителей простым языком',
      'семейная кодовая фраза и правила связи',
      'антискам-блок: коды, переводы, “безопасный счёт”, подозрительные звонки',
      'готовый текст, который можно отправить родственникам'
    ]
  },
  driver: {
    name: 'Водитель / Курьер',
    price: 1490,
    short: 'Чтобы не потерять смену, заказ и маршрут.',
    delivery: [
      'чек-лист перед сменой',
      'план действий при сбое навигатора',
      'шаблоны сообщений клиенту и диспетчеру',
      'инструкция по фиксации адреса и заказа при плохой связи',
      'памятка по офлайн-картам и резервным контактам'
    ]
  },
  business: {
    name: 'Бизнес План Б',
    price: 4990,
    short: 'Для точки, мастера, ПВЗ, салона, магазина или сервиса.',
    delivery: [
      'резервная страница связи и QR-комплект',
      'форма заявки для клиентов',
      'инструкция сотруднику при сбое связи или оплаты',
      'шаблоны объявлений и сообщений клиентам',
      'сценарии: не работает терминал, СБП, Telegram, WhatsApp, мобильный интернет'
    ]
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS'
    }
  });
}

function html(text, status = 200) {
  return new Response(text, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function sanitize(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function makeUid() {
  const d = new Date().toISOString().slice(0,10).replaceAll('-', '');
  const r = Math.random().toString(36).slice(2,8).toUpperCase();
  return `SOS-${d}-${r}`;
}

function adminToken(env) {
  return env.ADMIN_TOKEN || FALLBACK_ADMIN_TOKEN;
}

function isAdmin(request, env) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  return token === adminToken(env);
}

function db(env) {
  if (!env.SOS_DB) throw new Error('D1 binding SOS_DB is not configured');
  return env.SOS_DB;
}

async function hasColumn(database, table, column) {
  const info = await database.prepare(`PRAGMA table_info(${table})`).all();
  return Boolean((info.results || []).some(x => x.name === column));
}

async function addColumn(database, table, column, definition) {
  if (!(await hasColumn(database, table, column))) {
    await database.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

async function ensureSchema(database) {
  await database.prepare(`
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

  for (const [column, definition] of [
    ['order_uid','TEXT'], ['order_number','TEXT'], ['tariff_id','TEXT'], ['plan_id','TEXT'],
    ['tariff_name','TEXT'], ['plan_title','TEXT'], ['amount_rub','INTEGER'], ['price','INTEGER'],
    ['customer_name','TEXT'], ['customer_contact','TEXT'], ['customer_city','TEXT'], ['use_case','TEXT'],
    ['comment','TEXT'], ['customer_comment','TEXT'], ['payment_method',"TEXT DEFAULT 'sbp_alfa'"],
    ['telegram_chat_id','TEXT'], ['telegram_username','TEXT'], ['telegram_name','TEXT'],
    ['delivery_sent_at','TEXT'], ['updated_at','TEXT']
  ]) {
    await addColumn(database, 'orders', column, definition);
  }

  await database.prepare(`CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    contact TEXT,
    message TEXT NOT NULL,
    page TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
  await addColumn(database, 'feedback', 'page', 'TEXT');

  await database.prepare('CREATE INDEX IF NOT EXISTS idx_orders_uid ON orders(order_uid)').run();
  await database.prepare('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)').run();
  await database.prepare('CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at)').run();
}

function normalizeOrder(o) {
  return {
    ...o,
    order_uid: o.order_uid || o.order_number,
    tariff_id: o.tariff_id || o.plan_id,
    tariff_name: o.tariff_name || o.plan_title,
    amount_rub: o.amount_rub || o.price,
    comment: o.comment || o.customer_comment
  };
}

async function tg(env, method, payload) {
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

function botLink(env, orderUid = '') {
  const username = sanitize(env.TELEGRAM_BOT_USERNAME, 80).replace(/^@/, '');
  if (!username) return null;
  return orderUid ? `https://t.me/${username}?start=${encodeURIComponent(orderUid)}` : `https://t.me/${username}`;
}

function deliveryText(order) {
  const o = normalizeOrder(order);
  const tariff = TARIFFS[o.tariff_id] || { name: o.tariff_name || 'Цифровой План Б', delivery: [] };
  return [
    '✅ Оплата подтверждена',
    '',
    `Заказ: ${o.order_uid}`,
    `Тариф: ${tariff.name}`,
    '',
    'Что входит в ваш комплект:',
    ...(tariff.delivery.length ? tariff.delivery : ['цифровой комплект по выбранному тарифу']).map(x => `• ${x}`),
    '',
    'Как пользоваться:',
    '1. Откройте сайт SOS Интернет.',
    '2. Добавьте сайт на главный экран телефона как приложение.',
    '3. Заранее сохраните важные контакты, банки, адреса и SMS-шаблоны.',
    '4. Когда случится сбой — откройте раздел “Что случилось?” и действуйте по шагам.',
    '',
    'Сайт:',
    'https://sos-internet1.slava-plekhanov-2002.workers.dev',
    '',
    'Поддержка:',
    'VK: https://vk.com/bread1996',
    'Email: slava.plekhanov.2002@gmail.com'
  ].join('\n');
}

async function sendDelivery(database, env, orderUid) {
  const { results } = await database.prepare('SELECT * FROM orders WHERE order_uid = ? OR order_number = ? ORDER BY id DESC LIMIT 1')
    .bind(orderUid, orderUid).all();
  const order = results?.[0];
  if (!order) return { sent: false, reason: 'order_not_found' };
  const o = normalizeOrder(order);
  if (!o.telegram_chat_id) return { sent: false, reason: 'telegram_not_connected' };
  if (!env.TELEGRAM_BOT_TOKEN) return { sent: false, reason: 'telegram_token_missing' };

  await tg(env, 'sendMessage', {
    chat_id: o.telegram_chat_id,
    text: deliveryText(o),
    disable_web_page_preview: true
  });

  await database.prepare("UPDATE orders SET delivery_sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
    .bind(order.id).run();
  return { sent: true, chatId: o.telegram_chat_id };
}

async function apiOrders(request, env) {
  const database = db(env);
  await ensureSchema(database);

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const tariffId = sanitize(body.tariffId, 50);
    const tariff = TARIFFS[tariffId];
    if (!tariff) return json({ ok:false, error:'Unknown tariff', received: tariffId }, 400);

    const name = sanitize(body.name, 120);
    const contact = sanitize(body.contact, 180);
    if (!name || !contact) return json({ ok:false, error:'Name and contact are required' }, 400);

    const uid = makeUid();
    const city = sanitize(body.city, 120);
    const useCase = sanitize(body.useCase, 160);
    const comment = sanitize(body.comment, 1000);

    await database.prepare(`
      INSERT INTO orders (
        order_uid, order_number, tariff_id, plan_id, tariff_name, plan_title, amount_rub, price,
        customer_name, customer_contact, customer_city, use_case, comment, customer_comment,
        status, payment_method, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_payment', 'sbp_alfa', datetime('now'))
    `).bind(
      uid, uid, tariffId, tariffId, tariff.name, tariff.name, tariff.price, tariff.price,
      name, contact, city, useCase, comment, comment
    ).run();

    return json({
      ok:true,
      orderUid: uid,
      status: 'awaiting_payment',
      amountRub: tariff.price,
      tariffName: tariff.name,
      telegramBotLink: botLink(env, uid)
    });
  }

  if (request.method === 'GET') {
    if (!isAdmin(request, env)) return json({ ok:false, error:'Unauthorized' }, 401);
    const url = new URL(request.url);
    const status = sanitize(url.searchParams.get('status') || '', 40);
    const limit = Math.min(Number(url.searchParams.get('limit') || 80), 300);
    let stmt = status
      ? database.prepare('SELECT * FROM orders WHERE status = ? ORDER BY id DESC LIMIT ?').bind(status, limit)
      : database.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT ?').bind(limit);
    const { results } = await stmt.all();
    return json({ ok:true, orders:(results || []).map(normalizeOrder) });
  }

  if (request.method === 'PATCH') {
    if (!isAdmin(request, env)) return json({ ok:false, error:'Unauthorized' }, 401);
    const body = await request.json().catch(() => ({}));
    const orderUid = sanitize(body.orderUid, 80);
    const status = sanitize(body.status, 40);
    if (!orderUid || !['awaiting_payment','paid','delivered','cancelled'].includes(status)) {
      return json({ ok:false, error:'Invalid status or orderUid' }, 400);
    }
    await database.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE order_uid = ? OR order_number = ?")
      .bind(status, orderUid, orderUid).run();

    let delivery = { sent:false, reason:'not_paid_status' };
    if (status === 'paid' || status === 'delivered') {
      delivery = await sendDelivery(database, env, orderUid);
    }
    return json({ ok:true, delivery });
  }

  return json({ ok:false, error:'Method not allowed' }, 405);
}

async function apiFeedback(request, env) {
  const database = db(env);
  await ensureSchema(database);
  if (request.method !== 'POST') return json({ ok:false, error:'Method not allowed' }, 405);
  const body = await request.json().catch(() => ({}));
  const message = sanitize(body.message, 1500);
  if (!message) return json({ ok:false, error:'Message is required' }, 400);
  await database.prepare('INSERT INTO feedback (name, contact, message, page) VALUES (?, ?, ?, ?)')
    .bind(sanitize(body.name, 120), sanitize(body.contact, 180), message, sanitize(body.page, 200)).run();
  return json({ ok:true });
}

async function telegramWebhook(request, env) {
  const database = db(env);
  await ensureSchema(database);
  const update = await request.json().catch(() => ({}));
  const message = update.message || update.edited_message;
  if (!message || !message.chat) return json({ ok:true, ignored:true });

  const chatId = String(message.chat.id);
  const text = sanitize(message.text, 500);
  const from = message.from || {};
  const username = sanitize(from.username, 80);
  const fullName = sanitize([from.first_name, from.last_name].filter(Boolean).join(' '), 160);

  if (text.startsWith('/start')) {
    const orderUid = sanitize(text.split(/\s+/)[1] || '', 80);

    if (!orderUid) {
      await tg(env, 'sendMessage', {
        chat_id: chatId,
        text: 'Здравствуйте! Я бот выдачи заказов SOS Интернет.\n\nЧтобы привязать заказ, нажмите Telegram-кнопку после оформления заказа на сайте или отправьте:\n/start НОМЕР_ЗАКАЗА'
      });
      return json({ ok:true });
    }

    const { results } = await database.prepare('SELECT * FROM orders WHERE order_uid = ? OR order_number = ? ORDER BY id DESC LIMIT 1')
      .bind(orderUid, orderUid).all();

    if (!results?.[0]) {
      await tg(env, 'sendMessage', {
        chat_id: chatId,
        text: `Заказ ${orderUid} не найден. Проверьте номер заказа или напишите в поддержку: https://vk.com/bread1996`,
        disable_web_page_preview: true
      });
      return json({ ok:true, linked:false });
    }

    const order = normalizeOrder(results[0]);
    await database.prepare("UPDATE orders SET telegram_chat_id = ?, telegram_username = ?, telegram_name = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(chatId, username, fullName, results[0].id).run();

    await tg(env, 'sendMessage', {
      chat_id: chatId,
      text: `✅ Telegram привязан к заказу ${order.order_uid}.\n\nСтатус: ${order.status}\n\nПосле подтверждения оплаты комплект придёт сюда автоматически.`,
      disable_web_page_preview: true
    });

    if (order.status === 'paid' || order.status === 'delivered') {
      await sendDelivery(database, env, order.order_uid);
    }

    return json({ ok:true, linked:true, orderUid: order.order_uid });
  }

  await tg(env, 'sendMessage', {
    chat_id: chatId,
    text: 'Я бот выдачи заказов SOS Интернет.\n\nДля привязки заказа отправьте /start НОМЕР_ЗАКАЗА или нажмите Telegram-кнопку после оформления заказа на сайте.'
  });
  return json({ ok:true });
}

async function setWebhook(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  const headerOk = isAdmin(request, env);
  if (!headerOk && token !== adminToken(env)) return json({ ok:false, error:'Unauthorized' }, 401);
  if (!env.TELEGRAM_BOT_TOKEN) return json({ ok:false, error:'TELEGRAM_BOT_TOKEN is not configured' }, 500);
  const webhookUrl = new URL('/api/telegram/webhook', request.url).toString();
  const result = await tg(env, 'setWebhook', {
    url: webhookUrl,
    allowed_updates: ['message','edited_message'],
    drop_pending_updates: false
  });
  return json({ ok:true, webhookUrl, telegram: result });
}

async function botInfo(request, env) {
  if (!env.TELEGRAM_BOT_TOKEN) return json({ ok:false, error:'TELEGRAM_BOT_TOKEN is not configured' }, 500);
  const me = await tg(env, 'getMe', {});
  const wh = await tg(env, 'getWebhookInfo', {});
  return json({ ok:true, me: me.result, webhook: wh.result });
}

async function setupDb(request, env) {
  const database = db(env);
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  if (token !== adminToken(env)) return json({ ok:false, error:'Unauthorized' }, 401);
  if (url.searchParams.get('confirm') !== 'reset') return json({ ok:false, error:'Add &confirm=reset' }, 400);
  await database.prepare('DROP TABLE IF EXISTS orders').run();
  await database.prepare('DROP TABLE IF EXISTS feedback').run();
  await ensureSchema(database);
  return json({ ok:true, message:'Database initialized', build: VERSION });
}

async function debugDb(request, env) {
  if (!isAdmin(request, env)) return json({ ok:false, error:'Unauthorized' }, 401);
  const database = db(env);
  await ensureSchema(database);
  const tables = await database.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  const columns = await database.prepare("PRAGMA table_info(orders)").all();
  return json({ ok:true, tables: tables.results || [], ordersColumns: columns.results || [] });
}

async function fetchAsset(request, env) {
  if (env.ASSETS) return env.ASSETS.fetch(request);
  return html('<h1>SOS Интернет</h1><p>Static assets binding is not available.</p>', 500);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return json({ ok:true });

    try {
      if (url.pathname === '/admin') return fetchAsset(new Request(new URL('/admin.html', request.url)), env);
      if (url.pathname === '/diagnostics') return fetchAsset(new Request(new URL('/diagnostics.html', request.url)), env);

      if (url.pathname === '/api/health') {
        return json({
          ok:true,
          service:'sos-internet',
          build: VERSION,
          hasDbBinding: Boolean(env.SOS_DB),
          telegramConfigured: Boolean(env.TELEGRAM_BOT_TOKEN),
          telegramUsername: sanitize(env.TELEGRAM_BOT_USERNAME, 80) || null,
          adminFallback: !env.ADMIN_TOKEN
        });
      }
      if (url.pathname === '/api/orders') return apiOrders(request, env);
      if (url.pathname === '/api/feedback') return apiFeedback(request, env);
      if (url.pathname === '/api/setup-db') return setupDb(request, env);
      if (url.pathname === '/api/debug-db') return debugDb(request, env);
      if (url.pathname === '/api/telegram/webhook') return telegramWebhook(request, env);
      if (url.pathname === '/api/telegram/set-webhook') return setWebhook(request, env);
      if (url.pathname === '/api/telegram/info') return botInfo(request, env);
    } catch (err) {
      return json({ ok:false, error: err.message || 'Server error', stack: String(err.stack || '').slice(0, 900) }, 500);
    }

    return fetchAsset(request, env);
  }
};
