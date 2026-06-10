CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_uid TEXT UNIQUE NOT NULL,
  tariff_id TEXT NOT NULL,
  tariff_name TEXT NOT NULL,
  amount_rub INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  customer_contact TEXT NOT NULL,
  customer_city TEXT,
  use_case TEXT,
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'awaiting_payment',
  payment_method TEXT NOT NULL DEFAULT 'sbp_alfa',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  contact TEXT,
  message TEXT NOT NULL,
  page TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
