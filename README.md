
# SOS Интернет — telegram-auto-delivery-v9

Cloudflare Worker + Static Assets + D1 + автоматическая выдача через Telegram.

## Что появилось
- Клиент после заказа может нажать кнопку «Привязать Telegram».
- Telegram-бот получает `/start НОМЕР_ЗАКАЗА` и привязывает chat_id к заказу.
- Когда в админке поставить статус `paid` или `delivered`, Worker автоматически отправит клиенту комплект в Telegram.
- Если клиент привязал Telegram после того, как заказ уже был отмечен как `paid`, комплект отправится сразу после привязки.

## Важно
Telegram-бот не может сам написать человеку по @username, пока человек первым не откроет бота и не нажмёт Start. Поэтому на сайте после заказа появляется кнопка привязки Telegram.

## Переменные Cloudflare Worker
Обязательно:
- `TELEGRAM_BOT_TOKEN` — токен бота из BotFather.
- `TELEGRAM_BOT_USERNAME` — username бота без @, например `sos_planb_bot`.

Уже было:
- `ADMIN_TOKEN` — пароль админки. Если не задан, резервный токен: `sos_admin_2026_super_secret`.
- D1 binding: `SOS_DB`.

## После деплоя
1. Открой `/api/health` — должно быть `telegram-auto-delivery-v9`.
2. Открой `/api/telegram/set-webhook?token=sos_admin_2026_super_secret`
3. Должен прийти JSON с `"ok": true`.
4. Создай тестовый заказ.
5. Нажми кнопку Telegram после создания заказа.
6. В админке поставь статус `paid`.
7. Сообщение должно автоматически прийти в Telegram.

## Админка
- `/admin`
- `/admin.html`
