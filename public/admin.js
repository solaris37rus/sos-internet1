const tokenInput = document.getElementById('token');
const table = document.getElementById('ordersTable');
const statusBox = document.getElementById('adminStatus');
tokenInput.value = localStorage.getItem('adminToken') || '';
document.getElementById('saveToken').onclick = () => { localStorage.setItem('adminToken', tokenInput.value.trim()); statusBox.textContent = 'Токен сохранён.'; };
document.getElementById('loadOrders').onclick = loadOrders;
async function loadOrders(){
  statusBox.textContent = 'Загрузка...';
  const token = tokenInput.value.trim();
  const res = await fetch('/api/orders', { headers: { authorization: `Bearer ${token}` }});
  const data = await res.json();
  if(!res.ok){ statusBox.textContent = data.error || 'Ошибка'; return; }
  statusBox.textContent = `Загружено: ${data.orders.length}`;
  table.innerHTML = `<thead><tr><th>Заказ</th><th>Тариф</th><th>Клиент</th><th>Контакт</th><th>Статус</th><th>Дата</th><th>Действие</th></tr></thead><tbody>${data.orders.map(o=>`
    <tr>
      <td><strong>${o.order_uid}</strong><br>${o.customer_city || ''}</td>
      <td>${o.tariff_name}<br>${o.amount_rub} ₽<br>${o.use_case || ''}</td>
      <td>${o.customer_name}<br><small>${o.comment || ''}</small></td>
      <td>${o.customer_contact}</td>
      <td><span class="status-pill">${o.status}</span></td>
      <td>${o.created_at}</td>
      <td><select class="small" data-uid="${o.order_uid}"><option value="">Изменить</option><option value="paid">paid</option><option value="delivered">delivered</option><option value="cancelled">cancelled</option><option value="awaiting_payment">awaiting_payment</option></select></td>
    </tr>`).join('')}</tbody>`;
}
table.addEventListener('change', async e=>{
  const select = e.target.closest('[data-uid]');
  if(!select || !select.value) return;
  const token = tokenInput.value.trim();
  const res = await fetch('/api/orders', { method:'PATCH', headers:{'content-type':'application/json', authorization:`Bearer ${token}`}, body:JSON.stringify({orderUid:select.dataset.uid, status:select.value})});
  statusBox.textContent = res.ok ? 'Статус обновлён.' : 'Ошибка обновления.';
  await loadOrders();
});
