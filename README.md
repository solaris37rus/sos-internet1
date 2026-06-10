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
Проект сделан строго под Cloudflare Workers + Static Assets.

Важно: в папке `public` нет `_worker.js`, чтобы Wrangler не блокировал деплой.

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


## Исправление v11
Удалён `public/_worker.js`, из-за которого Wrangler выдавал ошибку `Uploading a Pages _worker.js file as an asset`.


## Исправление v12
Добавлен `public/.assetsignore` с правилом `_worker.js`, чтобы старый файл `public/_worker.js` не ломал деплой, даже если он остался в GitHub.
