const DEFAULT_TOKEN = 'sos_admin_2026_super_secret';
const tokenInput = document.getElementById('token');
const table = document.getElementById('ordersTable');
const statusBox = document.getElementById('adminStatus');
const statCount = document.getElementById('statCount');
const statRevenue = document.getElementById('statRevenue');
const statPaid = document.getElementById('statPaid');
const filterStatus = document.getElementById('filterStatus');

function getSavedToken(){
  return localStorage.getItem('adminToken') || DEFAULT_TOKEN;
}

tokenInput.value = getSavedToken();

document.getElementById('saveToken').onclick = () => {
  localStorage.setItem('adminToken', tokenInput.value.trim() || DEFAULT_TOKEN);
  statusBox.textContent = 'Токен сохранён локально в браузере.';
  statusBox.className = 'form-status ok';
};

document.getElementById('loadOrders').onclick = loadOrders;
filterStatus?.addEventListener('change', loadOrders);

function authHeaders(){
  const token = tokenInput.value.trim() || DEFAULT_TOKEN;
  return { authorization: `Bearer ${token}` };
}

function money(n){ return `${Number(n || 0).toLocaleString('ru-RU')} ₽`; }

function renderStats(orders){
  statCount.textContent = orders.length;
  statRevenue.textContent = money(orders.reduce((sum,o)=>sum + Number(o.amount_rub || o.price || 0),0));
  statPaid.textContent = orders.filter(o=>o.status === 'paid' || o.status === 'delivered').length;
}

async function loadOrders(){
  statusBox.textContent = 'Загрузка заказов...';
  statusBox.className = 'form-status';
  const qs = filterStatus?.value ? `?status=${encodeURIComponent(filterStatus.value)}` : '';
  const res = await fetch(`/api/orders${qs}`, { headers: authHeaders() });
  const data = await res.json().catch(()=>({ error:'Некорректный ответ сервера' }));
  if(!res.ok){
    statusBox.textContent = data.error || 'Ошибка';
    statusBox.className = 'form-status err';
    return;
  }
  const orders = data.orders || [];
  renderStats(orders);
  statusBox.textContent = `Загружено заказов: ${orders.length}`;
  statusBox.className = 'form-status ok';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Заказ</th>
        <th>Тариф</th>
        <th>Клиент</th>
        <th>Контакт</th>
        <th>Статус</th>
        <th>Telegram</th>
        <th>Дата</th>
        <th>Действие</th>
      </tr>
    </thead>
    <tbody>
      ${orders.map(o=>`
        <tr>
          <td>
            <div class="order-uid">${o.order_uid || o.order_number || '—'}</div>
            <div class="subtle">${o.customer_city || 'Город не указан'}</div>
          </td>
          <td>
            <div>${o.tariff_name || o.plan_title || '—'}</div>
            <div class="subtle">${money(o.amount_rub || o.price)}</div>
            <div class="subtle">${o.use_case || '—'}</div>
          </td>
          <td>
            <div>${o.customer_name || '—'}</div>
            <div class="subtle">${o.comment || o.customer_comment || ''}</div>
          </td>
          <td><div>${o.customer_contact || '—'}</div></td>
          <td><span class="status-pill status-${o.status}">${o.status}</span></td>
          <td>
            <div>${o.telegram_chat_id ? '✅ привязан' : '—'}</div>
            <div class="subtle">${o.telegram_username ? '@' + o.telegram_username : ''}</div>
            <div class="subtle">${o.delivery_sent_at ? 'выдано: ' + String(o.delivery_sent_at).slice(0,16) : ''}</div>
          </td>
          <td><div>${String(o.created_at || '').replace('T',' ').slice(0,16)}</div></td>
          <td>
            <select class="small" data-uid="${o.order_uid || o.order_number || ''}">
              <option value="">Изменить</option>
              <option value="paid">paid</option>
              <option value="delivered">delivered</option>
              <option value="cancelled">cancelled</option>
              <option value="awaiting_payment">awaiting_payment</option>
            </select>
          </td>
        </tr>
      `).join('')}
    </tbody>`;
}

table.addEventListener('change', async e=>{
  const select = e.target.closest('[data-uid]');
  if(!select || !select.value) return;
  const res = await fetch('/api/orders', {
    method:'PATCH',
    headers:{ 'content-type':'application/json', ...authHeaders() },
    body:JSON.stringify({ orderUid: select.dataset.uid, status: select.value })
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok){
    statusBox.textContent = data.error || 'Ошибка обновления';
    statusBox.className = 'form-status err';
    return;
  }
  if (data.delivery?.sent) {
    statusBox.textContent = 'Статус обновлён. Комплект автоматически отправлен в Telegram.';
  } else if (select.value === 'paid' || select.value === 'delivered') {
    const reason = data.delivery?.reason || 'unknown';
    statusBox.textContent = 'Статус обновлён, но автоотправка не выполнена: ' + reason + '. Клиент должен привязать Telegram через кнопку после заказа.';
  } else {
    statusBox.textContent = 'Статус обновлён.';
  }
  statusBox.className = 'form-status ok';
  await loadOrders();
});

loadOrders();
