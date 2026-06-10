# SOS Интернет — clean-premium-v10

Полностью чистая версия проекта.

## Что внутри
- Премиум PWA-сайт.
- Worker API.
- Cloudflare D1 база.
- Админка `/admin`.
- Диагностика `/diagnostics`.
- Telegram webhook.
- Автоматическая выдача после статуса `paid`.

## Важно
Проект сделан двойным способом:
- `src/worker.js` — для Cloudflare Workers.
- `public/_worker.js` — для Cloudflare Pages advanced mode.

Если `/api/health` открывает главную страницу, значит Cloudflare запущен не с этим Worker-кодом.

## Переменные Cloudflare
- `ADMIN_TOKEN` — необязательно, по умолчанию работает `sos_admin_2026_super_secret`
- `TELEGRAM_BOT_TOKEN` — Secret, токен бота из BotFather
- `TELEGRAM_BOT_USERNAME` — Text, username бота без @

## D1 binding
Binding должен называться строго:
`SOS_DB`

## Проверка
- `/api/health`
- `/diagnostics`
- `/admin`

## Webhook
После деплоя открыть:
`/api/telegram/set-webhook?token=sos_admin_2026_super_secret`
