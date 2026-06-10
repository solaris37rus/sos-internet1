const scenarios = [
  {
    id:'mobile',
    title:'Нет мобильного интернета',
    tag:'Связь',
    steps:[
      'Проверьте обычный звонок и SMS.',
      'Включите и выключите авиарежим один раз.',
      'Откройте 2–3 разных сервиса: Яндекс, VK, банк, карты.',
      'Если часть сервисов работает — используйте то, что доступно.',
      'Переходите на звонок, SMS, офлайн-карту и сохранённые данные.'
    ],
    note:'Главная цель — быстро понять: сеть умерла полностью или просто частично ограничена.'
  },
  {
    id:'bank',
    title:'Не открывается банк',
    tag:'Оплата',
    steps:[
      'Не нажимайте оплату много раз подряд.',
      'Проверьте запасной банк или вторую карту.',
      'Спросите у продавца оплату по СБП / QR / наличными.',
      'Если сумма важная — сделайте скрин ошибки.',
      'Сохраните запасной способ оплаты на будущее.'
    ],
    note:'Когда банк завис — задача не чинить его, а не остаться без денег и оплаты.'
  },
  {
    id:'messenger',
    title:'Не работает мессенджер',
    tag:'Мессенджеры',
    steps:[
      'Если вопрос срочный — сразу переходите на обычный звонок.',
      'Если не дозвонились — отправьте короткое SMS.',
      'Если есть Wi‑Fi — используйте email, VK или другой канал.',
      'Сохраните важные контакты не только внутри мессенджера.',
      'Для бизнеса держите резервную страницу связи и QR.'
    ],
    note:'Не ждите восстановления сервиса, если вопрос важный прямо сейчас.'
  },
  {
    id:'family',
    title:'Нужно связаться с семьёй',
    tag:'Семья',
    steps:[
      'Сначала обычный звонок.',
      'Если не проходит — SMS.',
      'Используйте шаблон: “Я в порядке. Если срочно — звони или пиши SMS”.',
      'Договоритесь о резервном родственнике и кодовой фразе.',
      'Пожилым родственникам дайте простую памятку без сложных слов.'
    ],
    note:'Семье нужен простой и понятный алгоритм, а не длинная теория.'
  },
  {
    id:'driver',
    title:'Сбой у водителя / курьера',
    tag:'Работа',
    steps:[
      'Остановитесь безопасно, если вы за рулём.',
      'Откройте скрин заказа или адреса.',
      'Позвоните клиенту обычным звонком.',
      'При необходимости запросите адрес обычным SMS.',
      'Зафиксируйте сбой и обновите статус после восстановления связи.'
    ],
    note:'Важнее сохранить заказ и контакт клиента, чем пытаться “лечить” приложение на ходу.'
  },
  {
    id:'business',
    title:'Бизнес теряет заявки',
    tag:'Бизнес',
    steps:[
      'Выведите резервный номер и QR на видное место.',
      'Переведите заявки в звонки, SMS или форму.',
      'Предложите альтернативную оплату.',
      'Дайте сотруднику короткий скрипт общения.',
      'После восстановления связи сверяйте оплаты и ручные заявки.'
    ],
    note:'Бизнес покупает не советы, а устойчивость продаж и связи с клиентом.'
  }
];

const tariffs = [
  {
    id:'personal',
    name:'Личный План Б',
    price:399,
    badge:'Старт',
    desc:'Персональный аварийный комплект: банк, карта, оплата, связь, мессенджеры, дорога и ежедневные сбои.',
    features:['20+ сценариев действий','антискам и шаблоны','офлайн TXT-документ','готовые фразы','чек-листы подготовки']
  },
  {
    id:'family',
    name:'Семейный План Б',
    price:990,
    badge:'Популярно',
    popular:true,
    desc:'Семейная защита: родители, дети, пожилые родственники, кодовая фраза, антискам и простые правила связи.',
    features:['всё из личного тарифа','памятка для родителей','кодовая фраза','семейный протокол','готовое сообщение родственникам']
  },
  {
    id:'driver',
    name:'Водитель / Курьер',
    price:1490,
    badge:'Работа',
    desc:'Рабочий комплект для смены: маршрут, клиент, диспетчер, фиксация сбоя и защита дохода.',
    features:['чек-лист смены','сбой навигатора','шаблоны клиенту','шаблоны диспетчеру','фиксация спорных ситуаций']
  },
  {
    id:'business',
    name:'Бизнес План Б',
    price:4990,
    badge:'Доход',
    desc:'Коммерческий комплект: заявки, QR, сотрудники, альтернативная оплата, резервная связь и план на 24 часа.',
    features:['резервная связь','QR и форма заявки','скрипты сотрудникам','альтернативная оплата','план на 24 часа']
  }
];

const faqs = [
  {
    q:'Что получает человек после оплаты?',
    a:'Клиент получает TXT-документ именно по выбранному тарифу: с чек-листами, сценариями, SMS-шаблонами, антискамом, готовыми фразами и полями для заполнения. Файл приходит в Telegram после подтверждения оплаты.'
  },
  {
    q:'Можно ли открыть файл на телефоне?',
    a:'Да. Документ специально отправляется в формате .txt, чтобы его можно было открыть и на телефоне, и на компьютере, сохранить офлайн, переслать или распечатать.'
  },
  {
    q:'Это замена VPN?',
    a:'Нет. Это не VPN и не средство обхода. Это цифровой аварийный набор: что делать, как связаться, чем оплатить, что сказать и какие резервные действия использовать.'
  },
  {
    q:'Как происходит выдача?',
    a:'Клиент оформляет заказ, оплачивает по СБП, привязывает Telegram, а после установки статуса paid в админке бот автоматически отправляет сообщение и документ.'
  },
  {
    q:'Если Telegram не привязан?',
    a:'Тогда заказ можно выдать вручную через VK или email. Для этого клиенту достаточно сообщить номер заказа.'
  }
];

const tabs = document.getElementById('scenarioTabs');
const view = document.getElementById('scenarioView');
const pricing = document.getElementById('pricingCards');
const faqList = document.getElementById('faqList');
const modal = document.getElementById('orderModal');
const form = document.getElementById('orderForm');
const statusBox = document.getElementById('formStatus');
let current = null;

function renderTabs(){
  tabs.innerHTML = scenarios.map((s,i)=>`<button class="tab ${i===0?'active':''}" data-id="${s.id}"><span>${String(i+1).padStart(2,'0')}</span>${s.title}</button>`).join('');
  renderScenario(scenarios[0].id);
  tabs.addEventListener('click', e=>{
    const btn = e.target.closest('[data-id]');
    if(!btn) return;
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    renderScenario(btn.dataset.id);
  });
}

function renderScenario(id){
  const s = scenarios.find(x=>x.id===id);
  if(!s) return;
  view.innerHTML = `
    <span class="tag">${s.tag}</span>
    <h2>${s.title}</h2>
    <ol class="steps">${s.steps.map(x=>`<li>${x}</li>`).join('')}</ol>
    <div class="note"><b>Важно:</b> ${s.note}</div>
    <div class="hero-actions">
      <a class="btn primary" href="#pricing">Получить полный комплект</a>
      <button class="btn ghost" type="button" onclick="window.print()">Распечатать</button>
    </div>`;
}

function renderPricing(){
  pricing.innerHTML = tariffs.map(t=>`
    <article class="price-card ${t.popular?'popular':''}">
      <div class="badge">${t.badge}</div>
      <h3>${t.name}</h3>
      <p>${t.desc}</p>
      <div class="price">${t.price.toLocaleString('ru-RU')} ₽ <small>разово</small></div>
      <ul>${t.features.map(f=>`<li>${f}</li>`).join('')}</ul>
      <button class="btn primary" data-buy="${t.id}">Купить</button>
    </article>`).join('');

  pricing.addEventListener('click', e=>{
    const btn = e.target.closest('[data-buy]');
    if(!btn) return;
    openOrder(btn.dataset.buy);
  });
}

function renderFaq(){
  faqList.innerHTML = faqs.map(item=>`
    <article class="faq-item">
      <button class="faq-question" type="button">
        <span>${item.q}</span>
        <span>+</span>
      </button>
      <div class="faq-answer">${item.a}</div>
    </article>`).join('');

  faqList.addEventListener('click', e=>{
    const q = e.target.closest('.faq-question');
    if(!q) return;
    const item = q.parentElement;
    item.classList.toggle('open');
    q.querySelector('span:last-child').textContent = item.classList.contains('open') ? '–' : '+';
  });
}

function openOrder(id){
  current = tariffs.find(t=>t.id===id);
  if(!current) return;
  document.getElementById('tariffId').value = current.id;
  document.getElementById('modalTitle').textContent = `${current.name} — ${current.price.toLocaleString('ru-RU')} ₽`;
  document.getElementById('modalDesc').textContent = `${current.desc} После оплаты комплект можно получить автоматически через Telegram.`;
  statusBox.textContent = '';
  statusBox.className = 'status';
  modal.showModal();
}

form.addEventListener('submit', async e=>{
  e.preventDefault();
  if(!current) return;
  const fd = new FormData(form);
  const payload = {
    tariffId: current.id,
    name: fd.get('name'),
    contact: fd.get('contact'),
    city: fd.get('city'),
    useCase: fd.get('useCase'),
    comment: fd.get('comment')
  };

  statusBox.textContent = 'Создаём заказ...';
  statusBox.className = 'status';

  try{
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: {'content-type':'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Ошибка сервера');

    const tg = data.telegramBotLink
      ? `<br><br><a class="btn ghost" href="${data.telegramBotLink}" target="_blank" rel="noopener">Привязать Telegram для автоматической выдачи</a>`
      : '';

    statusBox.className = 'status ok';
    statusBox.innerHTML = `Заказ создан: <b>${data.orderUid}</b><br>Оплатите ${current.price.toLocaleString('ru-RU')} ₽ по СБП на <b>+7 961 245-25-10</b>.<br>После оплаты привяжите Telegram или отправьте номер заказа в VK.${tg}`;
    localStorage.setItem('lastOrder', JSON.stringify(data));
  }catch(err){
    statusBox.className = 'status err';
    statusBox.textContent = 'Не удалось создать заказ: ' + (err.message || 'ошибка') + '. Напишите напрямую в VK.';
  }
});

document.addEventListener('click', async e=>{
  const c = e.target.closest('[data-copy]');
  if(!c) return;
  await navigator.clipboard.writeText(c.dataset.copy);
  const old = c.textContent;
  c.textContent = 'Скопировано';
  setTimeout(()=>c.textContent = old, 1200);
});

if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>navigator.serviceWorker.register('/sw.js'));
}

renderTabs();
renderPricing();
renderFaq();
