const VERSION = 'premium-value-pack-v14';
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

function deliveryIntroText(order) {
  const o = normalizeOrder(order);
  const tariff = TARIFFS[o.tariff_id] || { name: o.tariff_name || 'Цифровой План Б' };
  return [
    '✅ Оплата подтверждена.',
    '',
    `Заказ: ${o.order_uid}`,
    `Тариф: ${tariff.name}`,
    '',
    'Ниже отправляю ваш цифровой комплект отдельным текстовым файлом.',
    'Это не просто памятка, а готовый аварийный набор: чек-листы, шаблоны, сценарии, правила и инструкции.',
    'Файл можно открыть на телефоне, компьютере, переслать семье/сотрудникам и сохранить офлайн.'
  ].join('\n');
}

function section(title, lines) {
  return [
    '',
    '============================================================',
    title.toUpperCase(),
    '============================================================',
    '',
    ...lines
  ].join('\n');
}

function sub(title, lines) {
  return [
    '',
    '--- ' + title + ' ---',
    ...lines
  ].join('\n');
}

const COMMON_CORE = [
  section('Быстрый старт: что сделать за 15 минут прямо сейчас', [
    '1. Сохраните этот файл в телефон: “Файлы”, “Заметки”, “Избранное” или закрепите в Telegram.',
    '2. Сделайте скрин главных контактов: семья, работа, банк, врач, такси, школа/сад.',
    '3. Скачайте офлайн-карту своего города/района в любом удобном приложении.',
    '4. Запишите 3 адреса текстом: дом, работа, адрес близкого человека.',
    '5. Проверьте, умеете ли вы отправлять обычные SMS, а не только сообщения в мессенджерах.',
    '6. Добавьте сайт SOS Интернет на главный экран телефона.',
    '7. Сохраните резервный способ оплаты: наличные, вторая карта, СБП, QR или доверенный человек.',
    '8. Согласуйте с близкими правило: при сбое мессенджера переходим на звонок/SMS.',
    '9. Придумайте кодовую фразу для проверки личности при просьбах о деньгах.',
    '10. Зарядите пауэрбанк и положите его туда, где он реально будет доступен.'
  ]),
  section('Правило 3 минут при любом сбое', [
    'Минута 1: определите масштаб.',
    '- Не работает только одно приложение?',
    '- Не работает весь мобильный интернет?',
    '- Работают ли обычные звонки и SMS?',
    '- Работает ли Wi‑Fi?',
    '',
    'Минута 2: выберите резервный канал.',
    '- Срочно: обычный звонок.',
    '- Не дозвонились: SMS.',
    '- Есть Wi‑Fi: email/VK/резервный мессенджер.',
    '- Нужно оплатить: СБП/QR/наличные/другая карта.',
    '',
    'Минута 3: отправьте короткое уведомление важным людям.',
    'Шаблон: “У меня сбой связи/интернета. Если срочно — звони обычным звонком или SMS.”'
  ]),
  section('Диагностика: что именно сломалось', [
    'Проверка 1. Обычный звонок:',
    '- Если звонок работает, но интернет нет — проблема в передаче данных или ограничениях.',
    '- Если звонок не работает — возможен сбой сети/баланса/сим-карты/зоны покрытия.',
    '',
    'Проверка 2. SMS:',
    '- Если SMS работает — можно передавать короткие критичные сообщения.',
    '- Если SMS не работает — ищите Wi‑Fi или другую сим-карту.',
    '',
    'Проверка 3. Несколько сайтов:',
    '- Откройте поисковик, VK, банк, карты, сайт оператора.',
    '- Если часть открывается, а часть нет — используйте то, что доступно.',
    '',
    'Проверка 4. Другая сеть:',
    '- Wi‑Fi дома/в кафе/у знакомого.',
    '- Вторая SIM.',
    '- Раздача интернета от другого человека.',
    '',
    'Проверка 5. Деньги:',
    '- Есть ли наличные?',
    '- Есть ли другая карта?',
    '- Есть ли человек, который может оплатить вместо вас?'
  ]),
  section('SMS-шаблоны на случай сбоя', [
    'Семье:',
    '“Я в порядке. Интернет/мессенджер работает плохо. Если срочно — звони обычным звонком или SMS.”',
    '',
    'Родителям:',
    '“Не переживайте. Если Telegram/WhatsApp не работает, звоните мне обычным звонком. Деньги никому не переводите.”',
    '',
    'Клиенту:',
    '“Здравствуйте. Сейчас сбой связи, поэтому могу отвечать медленнее. Если срочно — позвоните обычным звонком.”',
    '',
    'Коллеге:',
    '“У меня нестабильная связь. Если не отвечаю в мессенджере, продублируй SMS или звонком.”',
    '',
    'Водителю/такси:',
    '“Интернет работает плохо. Адрес: [ВПИСАТЬ]. Если не отвечаю в приложении — звоните.”',
    '',
    'Продавцу/сервису:',
    '“Не проходит оплата из-за сбоя связи/банка. Могу оплатить СБП, QR, другой картой или наличными.”'
  ]),
  section('Что НЕ делать при сбоях', [
    '1. Не вводить коды из SMS на чужих сайтах.',
    '2. Не переводить деньги “для проверки”, “на безопасный счёт”, “временно”.',
    '3. Не устанавливать приложения по просьбе звонящего.',
    '4. Не отправлять фото карты, паспорта, коды и пароли.',
    '5. Не нажимать подряд оплату 10 раз, если банк завис.',
    '6. Не ругаться с сотрудниками магазина/сервиса — лучше быстро выбрать альтернативный способ оплаты.',
    '7. Не ждать 40 минут восстановления мессенджера, если вопрос срочный.',
    '8. Не полагаться только на один канал связи.'
  ]),
  section('Мини-набор офлайн-данных', [
    'Заполните и сохраните ниже:',
    '',
    'Мой номер телефона: ______________________________',
    'Второй номер / SIM: ______________________________',
    'Главный контакт семьи: ___________________________',
    'Резервный контакт семьи: _________________________',
    'Работа / начальник / коллега: ____________________',
    'Банк 1: _________________________________________',
    'Банк 2: _________________________________________',
    'Адрес дома: ______________________________________',
    'Адрес работы: ____________________________________',
    'Адрес близкого человека: _________________________',
    'Кодовая фраза семьи: _____________________________',
    'Где лежит наличка/карта/пауэрбанк: _______________'
  ])
];

const PERSONAL_EXTRA = [
  section('Личный комплект: сценарии на каждый день', [
    'Сценарий: не работает мобильный интернет',
    '1. Проверьте звонок и SMS.',
    '2. Отключите VPN/прокси, если они включены.',
    '3. Переключите сеть: 4G/3G/авто.',
    '4. Включите и выключите авиарежим один раз.',
    '5. Проверьте баланс и пакет интернета.',
    '6. Попробуйте Wi‑Fi или вторую SIM.',
    '7. Если срочно — используйте звонок/SMS, а не мессенджер.',
    '',
    'Сценарий: не открывается банк',
    '1. Не повторяйте платёж много раз.',
    '2. Проверьте, списались ли деньги.',
    '3. Попробуйте другой банк/карту.',
    '4. Попросите оплату через СБП/QR/наличные.',
    '5. Сделайте скрин ошибки, если сумма важная.',
    '6. Свяжитесь с банком позже через официальный номер.',
    '',
    'Сценарий: не проходит оплата в магазине',
    '1. Спросите: “Можно СБП по номеру или QR?”',
    '2. Проверьте другую карту.',
    '3. Предложите наличные.',
    '4. Если покупка не срочная — не делайте рискованные переводы.',
    '5. Сохраните чек/скрин, если платёж завис.',
    '',
    'Сценарий: не работает навигатор',
    '1. Откройте заранее сохранённый адрес.',
    '2. Позвоните человеку и уточните ориентиры.',
    '3. Используйте офлайн-карту.',
    '4. Сфотографируйте адрес/подъезд/код домофона заранее.',
    '',
    'Сценарий: срочно нужно связаться',
    '1. Обычный звонок.',
    '2. SMS.',
    '3. Звонок через другого человека.',
    '4. Email/VK при наличии Wi‑Fi.',
    '5. Если опасность — звоните в экстренные службы.'
  ]),
  section('Личный чек-лист перед поездкой/важным днём', [
    '[ ] Телефон заряжен выше 70%',
    '[ ] Пауэрбанк заряжен',
    '[ ] Офлайн-карта скачана',
    '[ ] Адрес назначения сохранён текстом',
    '[ ] Деньги разделены: карта + наличные',
    '[ ] Контакты семьи доступны без интернета',
    '[ ] Номер такси/водителя/организатора записан',
    '[ ] Банк/карта проверены заранее',
    '[ ] Важные документы сфотографированы или сохранены безопасно',
    '[ ] Этот файл доступен офлайн'
  ]),
  section('Готовые фразы для неловких ситуаций', [
    'В магазине:',
    '“У меня сейчас сбой банка/связи. Подскажите, пожалуйста, можно оплатить по СБП, QR или наличными?”',
    '',
    'В такси/доставке:',
    '“Интернет нестабильный. Если приложение не обновляется, я на связи по обычному звонку.”',
    '',
    'С родственниками:',
    '“Если от меня придёт странная просьба о деньгах — сначала позвони мне голосом и спроси кодовую фразу.”',
    '',
    'С работой:',
    '“Связь нестабильна, но я доступен по звонку/SMS. Важное продублируйте туда.”'
  ])
];

const FAMILY_EXTRA = [
  section('Семейный комплект: как объяснить родителям без сложных слов', [
    'Главное правило:',
    'Если не работает Telegram/WhatsApp — НЕ ПАНИКОВАТЬ. Звонить обычным звонком или SMS.',
    '',
    'Инструкция для родителей:',
    '1. Не нажимать непонятные ссылки.',
    '2. Не сообщать коды из SMS.',
    '3. Не переводить деньги по просьбе из сообщения.',
    '4. Если “сын/дочь” просит деньги — сначала позвонить голосом.',
    '5. Если звонящий торопит — положить трубку.',
    '6. Если говорят “из банка” — завершить разговор и самим позвонить в банк.',
    '7. Если интернет пропал — проверить обычный звонок.',
    '8. Если не получается — попросить помощи у заранее выбранного человека.'
  ]),
  section('Семейный протокол связи', [
    'Заполните вместе:',
    '',
    'Канал 1: обычный звонок',
    'Канал 2: SMS',
    'Канал 3: VK/email/другой мессенджер',
    'Канал 4: сосед/родственник рядом',
    '',
    'Если человек не отвечает:',
    '- 1 попытка звонка;',
    '- через 5 минут SMS;',
    '- через 10 минут повторный звонок;',
    '- затем связь через резервного родственника.',
    '',
    'Кодовая фраза:',
    '- должна быть простой, но не очевидной;',
    '- не должна быть датой рождения или кличкой питомца из соцсетей;',
    '- используется при просьбе о деньгах, документах, кодах.'
  ]),
  section('Антискам для семьи', [
    'Красные флаги:',
    '- “срочно”;',
    '- “никому не говорите”;',
    '- “назовите код”;',
    '- “установите приложение”;',
    '- “переведите на безопасный счёт”;',
    '- “ваш родственник попал в беду”;',
    '- “оформлен кредит”;',
    '- “сейчас приедет курьер за картой”.',
    '',
    'Правильный ответ:',
    '“Я сейчас сам/сама перезвоню в банк/родственнику.”',
    '',
    'Железное правило:',
    'Ни один настоящий сотрудник банка не имеет права спрашивать коды, пароли и просить перевести деньги на “безопасный счёт”.'
  ]),
  section('Памятка крупным текстом для распечатки', [
    '1. НЕ НАЗЫВАЙ КОДЫ ИЗ SMS.',
    '2. НЕ ПЕРЕВОДИ ДЕНЬГИ ПО ПРОСЬБЕ ИЗ СООБЩЕНИЯ.',
    '3. ЕСЛИ ИНТЕРНЕТ НЕ РАБОТАЕТ — ЗВОНИ ОБЫЧНЫМ ЗВОНКОМ.',
    '4. ЕСЛИ ЗВОНЯТ ИЗ БАНКА — ПОЛОЖИ ТРУБКУ И ПОЗВОНИ В БАНК САМ.',
    '5. ЕСЛИ ПРОСЯТ СРОЧНО — ЭТО МОЖЕТ БЫТЬ МОШЕННИК.',
    '6. ПЕРЕД ПЕРЕВОДОМ ДЕНЕГ СПРОСИ КОДОВУЮ ФРАЗУ.',
    '7. ЕСЛИ СОМНЕВАЕШЬСЯ — ПОЗВОНИ: ____________________'
  ])
];

const DRIVER_EXTRA = [
  section('Комплект водитель/курьер: чтобы не потерять смену и деньги', [
    'Перед сменой:',
    '[ ] Телефон заряжен',
    '[ ] Пауэрбанк в машине/сумке',
    '[ ] Офлайн-карта города скачана',
    '[ ] Сохранён номер диспетчера',
    '[ ] Сохранён резервный контакт поддержки',
    '[ ] Есть наличные на бензин/парковку/дорогу',
    '[ ] Адреса заказов скринятся до выезда',
    '[ ] Клиенту можно позвонить обычным звонком',
    '[ ] Включены SMS-уведомления банка'
  ]),
  section('Если пропал интернет во время заказа', [
    '1. Безопасно остановитесь, если вы за рулём.',
    '2. Не пытайтесь одновременно рулить и чинить приложение.',
    '3. Откройте скрин заказа/адреса.',
    '4. Позвоните клиенту обычным звонком.',
    '5. Сообщите, что есть сбой связи, но заказ выполняется.',
    '6. Если адрес неизвестен — запросите SMS с адресом.',
    '7. Если оплата зависла — фиксируйте время и статус.',
    '8. После восстановления связи обновите приложение и статус заказа.'
  ]),
  section('Шаблоны для водителя/курьера', [
    'Клиенту:',
    '“Здравствуйте. Сейчас сбой связи/навигации, но я выполняю заказ. Если приложение не обновляется — я на связи по обычному звонку.”',
    '',
    'Клиенту при уточнении адреса:',
    '“Пришлите, пожалуйста, адрес обычным SMS: улица, дом, подъезд, этаж, ориентир.”',
    '',
    'Диспетчеру:',
    '“По заказу возник сбой связи/навигации. Адрес/контакт клиента сохраняю, выполнение продолжаю. Связь держу через звонок/SMS.”',
    '',
    'Если опаздываете:',
    '“Из-за сбоя связи маршрут обновляется медленно. Я в пути, ориентировочное время прибытия: ___ минут.”'
  ]),
  section('Фиксация спорных ситуаций', [
    'Что сохранять:',
    '- скрин заказа;',
    '- скрин адреса;',
    '- время начала сбоя;',
    '- скрин ошибки приложения;',
    '- звонки клиенту/диспетчеру;',
    '- SMS-переписку;',
    '- фото места доставки при необходимости.',
    '',
    'Зачем:',
    '- доказать, что заказ не был брошен;',
    '- подтвердить задержку из-за связи;',
    '- защитить рейтинг и оплату.'
  ])
];

const BUSINESS_EXTRA = [
  section('Бизнес-комплект: сохранить клиентов, заявки и оплату', [
    'Минимальный резервный контур бизнеса:',
    '1. Резервный номер телефона.',
    '2. Резервный канал: VK/email/форма.',
    '3. QR-код на страницу связи.',
    '4. Инструкция сотруднику на 1 страницу.',
    '5. Альтернативная оплата: СБП по номеру, QR, наличные.',
    '6. Таблица ручных заявок.',
    '7. Текст объявления для клиентов.',
    '8. Скрипт разговора при сбое.'
  ]),
  section('Скрипт сотрудника при сбое', [
    'Клиент спрашивает: “Почему не работает?”',
    'Ответ:',
    '“Сейчас возможен технический сбой связи/оплаты. Мы работаем в ручном режиме. Я могу принять ваш заказ/заявку по телефону, SMS или через резервную форму.”',
    '',
    'Клиент не может оплатить:',
    '“Можем принять оплату альтернативно: СБП по номеру, QR, наличные или другой способ. Подскажите, как вам удобнее?”',
    '',
    'Клиент злится:',
    '“Понимаю, это неудобно. Чтобы не терять ваше время, я сейчас зафиксирую заявку вручную и подтвержу её, как только связь восстановится.”'
  ]),
  section('Ручная форма заявки', [
    'Используйте при сбое CRM/мессенджеров:',
    '',
    'Дата/время: __________________________',
    'Имя клиента: _________________________',
    'Телефон: _____________________________',
    'Что нужно: ___________________________',
    'Сумма/услуга: _________________________',
    'Способ оплаты: _______________________',
    'Комментарий: _________________________',
    'Кто принял заявку: ____________________',
    'Статус: новая / оплачена / выполнена / отменена'
  ]),
  section('Объявления для клиентов', [
    'Короткое:',
    '“Возможны сбои связи и оплаты. Мы работаем. Для связи используйте звонок/SMS/VK/email. Оплата доступна альтернативными способами.”',
    '',
    'Для соцсетей:',
    '“Друзья, если мессенджеры или оплата работают нестабильно, мы остаёмся на связи по телефону и VK. Заказы принимаем вручную, оплату можно провести по СБП/QR/наличными.”',
    '',
    'Для точки/офиса:',
    '“Если не проходит оплата картой, спросите сотрудника про СБП, QR или другой способ. Мы работаем в обычном режиме.”'
  ]),
  section('QR-комплект: что должно быть на резервной странице', [
    '- название бизнеса;',
    '- телефон;',
    '- VK/email;',
    '- адрес;',
    '- часы работы;',
    '- инструкция “что делать при сбое оплаты”;',
    '- форма заявки;',
    '- реквизиты/СБП при необходимости;',
    '- предупреждение: “не отправляйте коды и пароли”.'
  ]),
  section('План на 24 часа при массовом сбое', [
    '0–15 минут:',
    '- включить резервное объявление;',
    '- проверить телефоны и SMS;',
    '- дать сотрудникам короткий скрипт.',
    '',
    '15–60 минут:',
    '- перевести заявки в ручную таблицу;',
    '- включить альтернативную оплату;',
    '- отвечать клиентам по телефону/VK/email.',
    '',
    '1–6 часов:',
    '- обновлять объявление раз в 1–2 часа;',
    '- фиксировать все оплаты и заявки;',
    '- приоритет — текущие клиенты и оплаченные заказы.',
    '',
    '6–24 часа:',
    '- подвести список потерянных/ручных заявок;',
    '- сверить оплаты;',
    '- написать клиентам подтверждения;',
    '- обновить инструкции на будущее.'
  ])
];

function tariffDocument(order) {
  const o = normalizeOrder(order);
  const tariff = TARIFFS[o.tariff_id] || { name: o.tariff_name || 'Цифровой План Б', delivery: [] };
  const today = new Date().toISOString().slice(0, 10);

  let extra = PERSONAL_EXTRA;
  let bonus = [];
  if (o.tariff_id === 'family') {
    extra = [...PERSONAL_EXTRA, ...FAMILY_EXTRA];
    bonus = [
      section('Бонус семейного тарифа: готовое сообщение родственникам', [
        'Скопируйте и отправьте близким:',
        '',
        '“Я подготовил(а) для нас памятку на случай, если перестанет работать интернет, Telegram, WhatsApp, банк или оплата. Главное: если мессенджер не работает — звоним обычным звонком или SMS. Деньги по сообщениям не переводим, коды никому не называем, сначала проверяем голосом и кодовой фразой.”'
      ])
    ];
  } else if (o.tariff_id === 'driver') {
    extra = [...PERSONAL_EXTRA, ...DRIVER_EXTRA];
    bonus = [
      section('Бонус тарифа водитель/курьер: карточка перед сменой', [
        'Перед выходом:',
        '1. Скрин важных заказов.',
        '2. Зарядка/пауэрбанк.',
        '3. Офлайн-карта.',
        '4. Номер диспетчера.',
        '5. Наличные на дорогу.',
        '6. Шаблон клиенту готов.'
      ])
    ];
  } else if (o.tariff_id === 'business') {
    extra = [...PERSONAL_EXTRA, ...BUSINESS_EXTRA];
    bonus = [
      section('Бонус бизнес-тарифа: чек-лист внедрения за 1 день', [
        'Утро:',
        '- назначить ответственного за резервную связь;',
        '- создать резервный текст объявления;',
        '- проверить СБП/QR/наличные.',
        '',
        'День:',
        '- распечатать инструкцию сотруднику;',
        '- сделать QR на резервную страницу или контакт;',
        '- проверить форму ручной заявки.',
        '',
        'Вечер:',
        '- провести мини-тренировку: “мессенджер упал, оплата не проходит, клиент злится”;',
        '- исправить слабые места;',
        '- сохранить инструкции офлайн.'
      ])
    ];
  }

  return [
    'SOS ИНТЕРНЕТ — ЦИФРОВОЙ ПЛАН Б',
    'ПРЕМИУМ-КОМПЛЕКТ ГОТОВНОСТИ К СБОЯМ СВЯЗИ, ОПЛАТЫ И СЕРВИСОВ',
    '',
    `Дата выдачи: ${today}`,
    `Заказ: ${o.order_uid}`,
    `Тариф: ${tariff.name}`,
    `Клиент: ${o.customer_name || 'не указано'}`,
    '',
    'Этот файл можно открыть на телефоне и компьютере.',
    'Сохраните его офлайн, перешлите нужным людям и используйте как рабочую инструкцию.',
    '',
    section('Что вы купили', [
      `Тариф: ${tariff.name}`,
      `Стоимость: ${o.amount_rub || o.price || ''} ₽`,
      '',
      'Это не “общие советы из интернета”. Это структурированный аварийный комплект:',
      '- быстрые действия в первые минуты сбоя;',
      '- готовые SMS и фразы;',
      '- чек-листы подготовки;',
      '- антискам-правила;',
      '- сценарии для связи, банков, оплаты, карт, семьи, работы;',
      '- отдельные блоки под ваш тариф;',
      '- поля для заполнения личных данных;',
      '- инструкции, которые можно переслать родственникам, клиентам или сотрудникам.'
    ]),
    section('Состав комплекта по тарифу', (tariff.delivery && tariff.delivery.length ? tariff.delivery : ['цифровой комплект по выбранному тарифу']).map(x => `- ${x}`)),
    ...COMMON_CORE,
    ...extra,
    ...bonus,
    section('Финальный контрольный список', [
      '[ ] Файл сохранён офлайн',
      '[ ] Важные номера записаны',
      '[ ] Офлайн-карта скачана',
      '[ ] Есть резервный способ оплаты',
      '[ ] Семья знает правило звонок/SMS',
      '[ ] Кодовая фраза придумана',
      '[ ] Пауэрбанк заряжен',
      '[ ] Сайт SOS Интернет добавлен на главный экран',
      '[ ] Этот комплект отправлен тем, кому он нужен'
    ]),
    section('Поддержка', [
      'Сайт: https://sos-internet1.slava-plekhanov-2002.workers.dev',
      'VK: https://vk.com/bread1996',
      'Email: slava.plekhanov.2002@gmail.com',
      '',
      'Если вы хотите ручную адаптацию под свою семью, работу или бизнес — напишите в поддержку и укажите номер заказа.'
    ])
  ].join('\n');
}

function documentFilename(order) {
  const o = normalizeOrder(order);
  const tariff = sanitize(o.tariff_id || 'plan', 40).replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  const uid = sanitize(o.order_uid || 'order', 80).replace(/[^a-z0-9_-]/gi, '-');
  return `${uid}-${tariff}-plan-b.txt`;
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
    text: deliveryIntroText(o),
    disable_web_page_preview: true
  });

  const docText = tariffDocument(o);
  const file = new Blob([docText], { type: 'text/plain;charset=utf-8' });
  const form = new FormData();
  form.append('chat_id', o.telegram_chat_id);
  form.append('caption', `Ваш комплект: ${o.tariff_name || 'Цифровой План Б'}`);
  form.append('document', file, documentFilename(o));

  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
    method: 'POST',
    body: form
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.description || 'Telegram sendDocument failed');

  await database.prepare("UPDATE orders SET delivery_sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
    .bind(order.id).run();
  return { sent: true, chatId: o.telegram_chat_id, document: documentFilename(o) };
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
