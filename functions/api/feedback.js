function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}
function sanitize(input, max = 500) { return String(input || '').trim().slice(0, max); }
export async function onRequestPost({ request, env }) {
  try {
    if (!env.SOS_DB) return json({ error: 'D1 database binding SOS_DB is not configured' }, 500);
    const body = await request.json();
    const message = sanitize(body.message, 1500);
    if (!message) return json({ error: 'Message is required' }, 400);
    await env.SOS_DB.prepare('INSERT INTO feedback (name, contact, message, page) VALUES (?, ?, ?, ?)')
      .bind(sanitize(body.name, 120), sanitize(body.contact, 160), message, sanitize(body.page, 200)).run();
    return json({ ok: true });
  } catch (err) {
    return json({ error: 'Feedback failed' }, 500);
  }
}
