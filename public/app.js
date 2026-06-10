const scenarios = [
  {
    id:'mobile', title:'Нет мобильного интернета', tag:'Связь', note:'Не перезагружайте телефон бесконечно. Сначала определите: не работает всё или только часть сайтов.',
    steps:['Включите и выключите авиарежим один раз, затем проверьте обычный звонок.','Попробуйте открыть Яндекс, VK, Госуслуги, 2ГИС или приложение банка. Если открываются только отдельные сервисы — вероятен ограниченный режим.','Перейдите на базовые каналы: звонок, SMS, заранее сохранённые номера, офлайн-карта.','Для срочной связи отправьте короткое SMS: «Интернет не работает. Я доступен по звонку/SMS».','После восстановления связи сохраните офлайн-карту, важные номера и План Б на главный экран телефона.']
  },
  {
    id:'whitelist', title:'Работает только часть сайтов', tag:'Белый список', note:'Не обещаем точный список доступных сервисов: он может отличаться по региону, оператору и времени.',
    steps:['Проверьте, какие российские сервисы открываются: карты, банк, VK, Госуслуги, маркетплейсы.','Не тратьте время на сервисы, которые явно не открываются: используйте доступные каналы.','Если нужно оплатить — пробуйте СБП/QR, наличные или запасной банк.','Если нужно связаться — используйте звонок, SMS, VK, email или резервную страницу связи.','Сохраните на будущее список рабочих каналов именно для вашего города и оператора.']
  },
  {
    id:'bank', title:'Не открывается банк', tag:'Оплата', note:'Не вводите пароли на незнакомых сайтах и не переходите по подозрительным ссылкам «для восстановления банка».',
    steps:['Проверьте, есть ли обычная связь и открываются ли другие приложения.','Попробуйте другой банк или веб-версию только по официальному адресу.','Если нужно оплатить в магазине — спросите QR/СБП или оплату наличными.','Если платёж срочный — позвоните получателю и согласуйте резервный способ.','На будущее держите запасной банк, наличные и сохранённые реквизиты важных платежей.']
  },
  {
    id:'pay', title:'Не проходит оплата', tag:'Деньги', note:'Главная задача — не сорвать покупку/услугу и не паниковать на кассе.',
    steps:['Попросите продавца подождать и проверьте мобильную сеть или Wi‑Fi.','Попробуйте другой способ: СБП, QR, наличные, другой банк.','Если интернет у магазина не работает — попросите номер/QR для оплаты позже и чек/подтверждение.','Не отправляйте деньги на сомнительные личные карты без подтверждения, что это официальный получатель.','На будущее сохраните офлайн-инструкцию по оплатам и держите небольшой резерв наличных.']
  },
  {
    id:'telegram', title:'Не работает Telegram', tag:'Мессенджер', note:'Если вопрос срочный, не ждите восстановления мессенджера — переходите на резервные каналы.',
    steps:['Проверьте, работает ли обычный интернет и другие приложения.','Попробуйте отправить текст без медиа и звонков.','Для срочного контакта используйте звонок, SMS, VK, email или другой согласованный канал.','Если вы ведёте клиентов/канал — разместите резервную ссылку связи в VK, 2ГИС, Яндекс Картах и на сайте.','На будущее соберите резервные контакты важных людей и клиентов.']
  },
  {
    id:'maps', title:'Не грузятся карты/навигатор', tag:'Дорога', note:'Офлайн-карта должна быть скачана заранее. Когда связи уже нет, загрузить район может не получиться.',
    steps:['Проверьте, открывается ли уже загруженная карта или история маршрута.','Позвоните человеку/организации и уточните адрес голосом.','Используйте сохранённые адреса: дом, работа, школа, больница, важные точки.','Если вы водитель — зафиксируйте адрес заказа скрином заранее перед выездом.','После восстановления связи скачайте офлайн-карту своего города и области.']
  },
  {
    id:'family', title:'Нужно связаться с семьёй', tag:'Семья', note:'Для пожилых родственников лучше заранее сделать крупную памятку с 3–5 действиями.',
    steps:['Позвоните обычным звонком. Если не проходит — отправьте SMS.','Используйте короткий шаблон: «Я в порядке. Интернет плохо работает. Звони/SMS».','Если человек пожилой — не просите его искать сложные настройки, дайте один понятный канал.','Договоритесь о семейной кодовой фразе на случай подозрительных звонков.','Сохраните важные номера в избранное и распечатайте памятку.']
  },
  {
    id:'driver', title:'Я водитель/курьер', tag:'Работа', note:'Для водителя сбой связи — это риск потерять смену, заказ, маршрут и клиента.',
    steps:['Перед сменой скачайте офлайн-карту района и сохраните адреса заказов.','Если карта не грузится — позвоните клиенту и уточните ориентиры.','Если приложение заказа не работает — сделайте скрин/фото текущей информации.','Отправьте клиенту SMS: «Интернет нестабилен, я на связи по звонку/SMS».','После смены подготовьте водительский План Б: карты, шаблоны, контакты диспетчера и клиентов.']
  },
  {
    id:'business', title:'У меня бизнес', tag:'Клиенты', note:'Бизнесу нужен не совет, а резервная система: страница, QR, форма заявки и инструкция сотруднику.',
    steps:['Разместите резервный номер и QR-код там, где клиент их увидит: дверь, стойка, VK, 2ГИС, Яндекс.','Если мессенджеры не работают — переведите заявки в форму или звонки.','Если не проходит оплата — предложите СБП/QR/наличные и готовый текст объяснения.','Дайте сотруднику короткую инструкцию: что сказать клиенту, куда записать заявку, кому сообщить.','Подготовьте бизнес-пакет: резервная страница, шаблоны, памятки и QR-комплект.']
  }
];

const tariffs = [
  {id:'personal', name:'Личный План Б', price:399, badge:'Старт', desc:'Для обычного человека: связь, банк, карты, оплата и семья.', features:['20 аварийных сценариев','Офлайн-доступ через PWA','Чек-лист подготовки телефона','SMS-шаблоны','Памятка при белом списке']},
  {id:'family', name:'Семейный План Б', price:990, badge:'Популярно', popular:true, desc:'Для родителей, детей и пожилых родственников.', features:['Всё из личного пакета','Крупная памятка для родителей','Семейная кодовая фраза','Антискам-инструкции','PDF для печати']},
  {id:'driver', name:'Водитель / Курьер', price:1490, badge:'Работа', desc:'Чтобы не потерять смену, маршрут и заказ при сбоях связи.', features:['Офлайн-подготовка к смене','Шаблоны клиенту','План при сбое навигатора','План при сбое приложения','Контакты и чек-листы']},
  {id:'business', name:'Бизнес План Б', price:4990, badge:'Доход', desc:'Для точки, мастера, ПВЗ, салона, магазина или сервиса.', features:['Резервная страница связи','QR-код для клиентов','Форма заявки','Инструкция сотрудникам','Шаблоны объявлений и оплат']}
];

const scenarioList = document.getElementById('scenarioList');
const scenarioCard = document.getElementById('scenarioCard');
const pricingGrid = document.getElementById('pricingGrid');
const modal = document.getElementById('orderModal');
const form = document.getElementById('orderForm');
const statusBox = document.getElementById('formStatus');
let currentTariff = null;

function renderScenarios(){
  scenarioList.innerHTML = scenarios.map((s,i)=>`<button class="scenario-tab ${i===0?'active':''}" data-scenario="${s.id}"><span>${String(i+1).padStart(2,'0')}</span>${s.title}</button>`).join('');
  renderScenario(scenarios[0].id);
  scenarioList.addEventListener('click', e=>{
    const btn = e.target.closest('[data-scenario]');
    if(!btn) return;
    document.querySelectorAll('.scenario-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    renderScenario(btn.dataset.scenario);
  });
}
function renderScenario(id){
  const s = scenarios.find(x=>x.id===id);
  scenarioCard.innerHTML = `<span class="tag">${s.tag}</span><h2>${s.title}</h2><ol class="steps">${s.steps.map(step=>`<li>${step}</li>`).join('')}</ol><div class="scenario-note"><strong>Важно:</strong> ${s.note}</div><div class="hero-actions"><a class="btn btn-primary" href="#plans">Сохранить полный План Б</a><button class="btn btn-secondary" onclick="window.print()">Распечатать</button></div>`;
}
function renderTariffs(){
  pricingGrid.innerHTML = tariffs.map(t=>`<article class="price-card ${t.popular?'popular':''}">
    <div class="price-badge">${t.badge}</div>
    <h3>${t.name}</h3>
    <p>${t.desc}</p>
    <div class="price">${t.price.toLocaleString('ru-RU')} ₽ <small>разово</small></div>
    <ul>${t.features.map(f=>`<li>${f}</li>`).join('')}</ul>
    <button class="btn btn-primary" data-buy="${t.id}">Купить</button>
  </article>`).join('');
  pricingGrid.addEventListener('click', e=>{
    const btn = e.target.closest('[data-buy]');
    if(!btn) return;
    openOrder(btn.dataset.buy);
  });
}
function openOrder(id){
  currentTariff = tariffs.find(t=>t.id===id);
  document.getElementById('tariffId').value = currentTariff.id;
  document.getElementById('modalPlanName').textContent = `${currentTariff.name} — ${currentTariff.price.toLocaleString('ru-RU')} ₽`;
  document.getElementById('modalPlanDescription').textContent = currentTariff.desc + ' После оплаты вы получите комплект и инструкцию по выбранному тарифу.';
  statusBox.textContent=''; statusBox.className='form-status';
  modal.showModal();
}

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!currentTariff) return;
  const fd = new FormData(form);
  const payload = {
    tariffId: currentTariff.id,
    tariffName: currentTariff.name,
    amountRub: currentTariff.price,
    name: fd.get('name'),
    contact: fd.get('contact'),
    city: fd.get('city'),
    useCase: fd.get('useCase'),
    comment: fd.get('comment')
  };
  statusBox.textContent = 'Создаём заказ...';
  try{
    const res = await fetch('/api/orders', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Ошибка');
    statusBox.className='form-status ok';
    statusBox.innerHTML = `Заказ создан: <strong>${data.orderUid}</strong><br>Теперь переведите ${currentTariff.price.toLocaleString('ru-RU')} ₽ по СБП на +7 961 245-25-10 и отправьте номер заказа в <a href="https://vk.com/bread1996" target="_blank" rel="noopener">VK</a>.`;
    localStorage.setItem('lastOrder', JSON.stringify(data));
  }catch(err){
    statusBox.className='form-status err';
    statusBox.textContent = 'Не удалось создать заказ: ' + (err.message || 'ошибка сервера') + '. Напишите напрямую в VK.';
  }
});

document.addEventListener('click', async e=>{
  const copy = e.target.closest('[data-copy]');
  if(copy){
    await navigator.clipboard.writeText(copy.dataset.copy);
    copy.textContent = 'Скопировано';
    setTimeout(()=>copy.textContent = copy.dataset.copy, 1400);
  }
});

function renderQuiz(){
  const quiz = document.getElementById('quiz');
  const items = [
    'У меня скачана офлайн-карта города',
    'Я сохранил важные номера семьи',
    'У меня есть SMS-шаблоны на случай сбоя',
    'У меня есть запасной способ оплаты',
    'У родителей есть простая памятка',
    'У бизнеса/работы есть резервная связь'
  ];
  quiz.innerHTML = `<div class="quiz-card"><div class="quiz-score" id="score">0%</div><p id="scoreText">Отметьте пункты, чтобы узнать готовность.</p><a class="btn btn-primary" href="#plans">Подготовиться</a></div><div class="quiz-card">${items.map((it,i)=>`<label class="quiz-item"><input type="checkbox" data-check><span>${it}</span></label>`).join('')}</div>`;
  quiz.addEventListener('change', ()=>{
    const checks = [...document.querySelectorAll('[data-check]')];
    const done = checks.filter(c=>c.checked).length;
    const score = Math.round(done/checks.length*100);
    document.getElementById('score').textContent = `${score}%`;
    document.getElementById('scoreText').textContent = score < 50 ? 'Готовность низкая. Лучше подготовить План Б заранее.' : score < 85 ? 'Неплохо, но есть слабые места.' : 'Отлично. Осталось сохранить инструкции офлайн.';
  });
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  btn.hidden = false;
  btn.addEventListener('click', async ()=>{
    btn.hidden = true;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  });
});

if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>navigator.serviceWorker.register('/sw.js'));
}

renderScenarios();
renderTariffs();
renderQuiz();
