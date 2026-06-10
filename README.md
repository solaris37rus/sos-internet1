# SOS Интернет — исправленная версия для Cloudflare Workers + Static Assets

Эта версия исправляет ошибку Cloudflare `Missing entry-point to Worker script or assets directory`.
Теперь проект можно деплоить как Cloudflare Worker со статическими файлами, backend API и D1-базой.

## Структура

- `public/` — сайт/PWA.
- `src/worker.js` — backend API + раздача сайта.
- `db/schema.sql` — таблицы D1.
- `wrangler.toml` — исправленная конфигурация Cloudflare.
- `public/admin.html` — админка заказов.

## Что важно

Backend использует binding базы с названием `SOS_DB`.
Админка использует секрет `ADMIN_TOKEN`.

## API

- `POST /api/orders` — создать заказ.
- `GET /api/orders` — список заказов, нужен `Authorization: Bearer ADMIN_TOKEN`.
- `PATCH /api/orders` — обновить статус заказа.
- `POST /api/feedback` — обратная связь.
- `GET /api/health` — проверка backend.

## Оплата

На сайте указана ручная оплата по СБП/Альфа-Банк на номер:

`+7 961 245-25-10`

Клиент создаёт заказ, переводит деньги, затем отправляет номер заказа в VK/email.
Автоматическое подтверждение перевода невозможно без банковского API/эквайринга.

## Быстрый запуск

1. Загрузите проект в GitHub.
2. В Cloudflare откройте Workers & Pages.
3. Создайте приложение через Import repository.
4. Выберите этот репозиторий.
5. Cloudflare увидит `wrangler.toml` и задеплоит Worker.
6. Создайте D1-базу `sos-internet-db`.
7. Выполните SQL из `db/schema.sql` в D1 Console.
8. В настройках Worker добавьте D1 binding:
   - Variable name: `SOS_DB`
   - Database: `sos-internet-db`
9. Добавьте secret/environment variable:
   - `ADMIN_TOKEN` = ваш_секретный_пароль
10. Откройте сайт и проверьте `/api/health`.
11. Откройте `/admin.html` и введите `ADMIN_TOKEN`.

## Локально

```bash
npm install
npm run dev
```

Для локального D1 нужна отдельная настройка Wrangler. На Cloudflare всё подключается через bindings.
