# SOS Интернет — premium-v8

Cloudflare Worker + Static Assets + D1.

## Главное
- Сайт и админка работают из одного Worker.
- Админка доступна по `/admin` и `/admin.html`.
- Если переменная `ADMIN_TOKEN` в Cloudflare не задана, сервер использует резервный токен:
  `sos_admin_2026_super_secret`
- D1 binding должен называться `SOS_DB`.

## Проверка
- `/api/health` — показывает build `premium-v8`
- `/admin` — админка

## Cloudflare
- Worker name: любой
- Build command: пусто
- Deploy command: `npx wrangler deploy`
