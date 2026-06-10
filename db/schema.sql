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
);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  contact TEXT,
  message TEXT NOT NULL,
  page TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
