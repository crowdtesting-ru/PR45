let tg = window.Telegram.WebApp;
tg.ready();

let excelData = null;      // Данные с вкладки "Распределение"
let scenariosData = null;  // Данные с вкладки "Текст"

// 1. Загружаем Excel-файл и читаем 2 листа
fetch('PR45.xlsx')
  .then(response => {
    if (!response.ok) {
      throw new Error('Ошибка загрузки файла');
    }
    return response.arrayBuffer();
  })
  .then(buffer => {
    const workbook = XLSX.read(buffer, { type: 'array' });

    // Названия вкладок:
    const distributionSheet = workbook.Sheets['Распределение'];
    const textSheet = workbook.Sheets['Текст']; 
    // (убедитесь, что листы называются именно так)

    // Превращаем их в JSON
    excelData = XLSX.utils.sheet_to_json(distributionSheet);
    scenariosData = XLSX.utils.sheet_to_json(textSheet);

  })
  .catch(error => {
    showNotification('Ошибка загрузки данных. Обратитесь к администратору.');
  });

// 2. Вешаем обработчик на кнопку
document.getElementById('searchBtn').addEventListener('click', searchData);

// Утилита для "очистки" ФИО
function normalizeString(str) {
  return (str || '')
    .replace(/\s/g, '')
    .toLowerCase()
    .replace(/ё/g, 'е');
}

// Форматируем сценарий, сохраняя нумерацию, переносы строк и выделяя первый пункт жирным
function formatScenario(text) {
  if (!text) return '';
  
  let isFirstNumberedPoint = true;
  
  // Разбиваем на строки и обрабатываем каждую
  const lines = text.split('\n')
    .map(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return '<div style="padding-left: 20px;">&nbsp;</div>'; // Пустая строка - сохраняем как пробел
      
      // Если это пункт с номером (начинается с цифры и точки)
      if (/^\d+\./.test(trimmedLine)) {
        if (isFirstNumberedPoint) {
          isFirstNumberedPoint = false;
          return `<div style="padding-left: 20px;"><strong>${trimmedLine}</strong></div>`;
        } else {
          return `<div style="padding-left: 20px;">${trimmedLine}</div>`;
        }
      }
      
      // Обычная строка
      return `<div style="padding-left: 20px;">${trimmedLine}</div>`;
    })
    .join('');
  
  // Добавляем переносы строк до и после сценария
  return `<br>${lines}<br>`;
}

// Функция для получения правильной ссылки на анкету
function getFormLink(botType) {
  if (botType === 'Чат-бот') {
    return 'https://forms.gle/3qsDwxqhXYJFPtiW6';
  } else if (botType === 'Голосового бот') {
    return 'https://forms.gle/BqhGt3PpZc6hM6W6A';
  }
  return 'ССЫЛКА'; // Если тип не определен, оставляем как есть
}

function searchData() {
  if (!excelData || !scenariosData) {
    showNotification('Подождите, данные ещё загружаются...');
    return;
  }

  const nameInput = document.getElementById('name').value;
  const companyInput = document.getElementById('company').value;
  const resultContainer = document.getElementById('result');

  if (!nameInput || !companyInput) {
    showNotification('Пожалуйста, заполните все поля');
    resultContainer.style.display = 'none';
    return;
  }

  // Нормализуем для поиска ФИО
  const normalizedInput = normalizeString(nameInput);

  // Проверяем, существует ли пользователь с таким ФИО
  const foundByName = excelData.find(row => {
    return normalizeString(row['ФИО']) === normalizedInput;
  });
  if (!foundByName) {
    showNotification('ФИО не найдено, проверьте правильность');
    resultContainer.style.display = 'none';
    return;
  }

  // Ищем строку: ФИО + Компания
  const match = excelData.find(row => {
    return (
      normalizeString(row['ФИО']) === normalizedInput &&
      row['Компания'] === companyInput
    );
  });
  if (!match) {
    showNotification(`Для ${nameInput} нет сценария с компанией ${companyInput}`);
    resultContainer.style.display = 'none';
    return;
  }

  // Название столбца для первой/второй части сценария (например "МТС Голосового бот")
  const firstScenarioColumn = `${match['Компания']} ${match['Обращение 1']}`;
  const secondScenarioColumn = `${match['Компания']} ${match['Обращение 2']}`;

  // Берём первую строчку листа "Текст" (т. е. вторую строку Excel) —
  // scenariosData[0], где хранятся столбцы "МТС Голосового бот", "Сбербанк Чат-бот" и т. д.
  const scenarioRow = scenariosData[0] || {};

  // Пытаемся вытащить текст
  let firstScenario = scenarioRow[firstScenarioColumn] || null;
  let secondScenario = scenarioRow[secondScenarioColumn] || null;

  // Теперь учитываем, что у пользователя в столбце golos, chat написано, например, "Сценарий 2" / "Сценарий 5".
  // Внутри текста firstScenario / secondScenario могут быть метки <golos> или <chat>.
  // Подставим туда соответствующие сценарии из scenariosData[0]["Сценарий 2"], scenariosData[0]["Сценарий 5"].

  const userGolos = match['golos']; // Например "Сценарий 2"
  const userChat = match['chat'];   // Например "Сценарий 5"

  // 1) Для firstScenario
  if (firstScenario) {
    // Если в тексте есть <golos>, подменяем
    if (userGolos && scenarioRow[userGolos]) {
      const golosText = scenarioRow[userGolos];
      firstScenario = firstScenario.replace(
        /<golos>/g,
        `<i>${formatScenario(golosText)}</i>`
      );
    }
    // Аналогично <chat>
    if (userChat && scenarioRow[userChat]) {
      const chatText = scenarioRow[userChat];
      firstScenario = firstScenario.replace(
        /<chat>/g,
        `<i>${formatScenario(chatText)}</i>`
      );
    }
  }

  // 2) Для secondScenario
  if (secondScenario && match['Обращение 2']) {
    if (userGolos && scenarioRow[userGolos]) {
      const golosText = scenarioRow[userGolos];
      secondScenario = secondScenario.replace(
        /<golos>/g,
        `<i>${formatScenario(golosText)}</i>`
      );
    }
    if (userChat && scenarioRow[userChat]) {
      const chatText = scenarioRow[userChat];
      secondScenario = secondScenario.replace(
        /<chat>/g,
        `<i>${formatScenario(chatText)}</i>`
      );
    }
  }

  // Заменяем тег <Номер Телефона для МТС> на номер телефона
  if (match['Номер Телефона для МТС']) {
    const phoneNumber = match['Номер Телефона для МТС'];
    
    // Заменяем в первом сценарии
    if (firstScenario) {
      firstScenario = firstScenario.replace(
        /<Номер Телефона для МТС>/g,
        `<strong>${phoneNumber}</strong>`
      );
    }
    
    // Заменяем во втором сценарии
    if (secondScenario) {
      secondScenario = secondScenario.replace(
        /<Номер Телефона для МТС>/g,
        `<strong>${phoneNumber}</strong>`
      );
    }
  }

  // Покажем всё остальное, как в вашем шаблоне:
  // Собираем компании/устройства (если у одного ФИО несколько компаний)
  const allEntriesForName = excelData.filter(row => {
    return normalizeString(row['ФИО']) === normalizedInput;
  });
  const companiesList = allEntriesForName
    .map(entry => `<strong>${entry['Компания']}</strong> - <strong>${entry['Устройство']}</strong>`)
    .join('\n');
  const hasMultipleCompanies = allEntriesForName.length > 1;

  // Проверка на МТС (чтобы подставить номер телефона)
  const isMTS = (match['Компания'] === 'МТС');
  const mtsPhone = isMTS ? match['Номер Телефона для МТС'] : '';
  const mtsText = isMTS
    ? `Для обращения в бота просим вас использовать номер телефона МТС, <b>который вы указали в анкете</b>: <b>${mtsPhone}</b>`
    : '';

  // Получаем ссылки для анкет
  const firstFormLink = getFormLink(match['Обращение 1']);
  const secondFormLink = match['Обращение 2'] ? getFormLink(match['Обращение 2']) : '';

  // Финальный HTML
  const result = `
  <div style="font-size: 16px; line-height: 1.5; white-space: pre-line;">
Добрый день, <strong>${match['ФИО']}</strong>!

<div class="collapsible-section">
  <div class="section-header" onclick="toggleSection(this)">
    <h3>ИНФОРМАЦИЯ ПО УЧАСТИЮ</h3>
  </div>
  <div class="section-content">
    ${
      hasMultipleCompanies 
      ? `В проекте ID-PR45 вас отобрали для участия в исследовании сразу нескольких компаний на девайсе следующей операционной системы:`
      : `В проекте ID-PR45 вас отобрали для участия в исследовании на девайсе следующей операционной системы:`
    }
    ${companiesList}

    <strong>Важно!</strong>
    Если вы не можете принять участие в исследовании конкретной компании из списка выше - просим сообщить об этом в чат в Телеграм-канале проекта (ID-PR45), чтобы мы успели вовремя найти замену!

    ${
      hasMultipleCompanies
      ? `<strong>Обратите внимание!</strong> Инструкция ниже актуальна только для исследования компании <strong>${match['Компания']}!</strong> Для других компаний инструкции будут другие, чтобы увидеть их - выберите в форме слева нужную компанию.`
      : `<strong>Обратите внимание!</strong> Инструкция ниже актуальна только для исследования компании <strong>${match['Компания']}!</strong>`
    }
  </div>
</div>

<div class="section-divider"></div>

ИССЛЕДОВАНИЕ <strong>${match['Компания']}</strong> БОТОВ

Необходимо будет выполнить обращения в ботов на устройстве с ОС: <strong>${match['Устройство']}</strong>
${mtsText}

<div class="check-section">
  Для <strong>первой</strong> проверки вам необходимо проверить работу <strong>${match['Обращение 1']}а</strong> по следующему сценарию:
  ${
    firstScenario
    ? formatScenario(firstScenario)
    : `Не найден сценарий для столбца "${firstScenarioColumn}"`
  }

  По завершению просим сразу заполнить анкету по ссылке: <a href="${firstFormLink}" target="_blank">${firstFormLink}</a>
</div>

${
  match['Обращение 2']
    ? `
<div class="section-divider"></div>

<div class="check-section">
  Для <strong>второй</strong> проверки вам необходимо проверить работу <strong>${match['Обращение 2']}а</strong> по следующему сценарию:
  ${
    secondScenario
    ? formatScenario(secondScenario)
    : `Не найден сценарий для столбца "${secondScenarioColumn}"`
  }

  По завершению просим сразу заполнить анкету по ссылке: <a href="${secondFormLink}" target="_blank">${secondFormLink}</a>
</div>
`
    : ''
}

Если вы участвуете в исследовании нескольких компаний, то введите ваши ФИО в поле ввода вверху этой страницы и выберите следующую компанию.</div>`;

  // Выводим результат
  resultContainer.innerHTML = result;
  resultContainer.style.display = 'block';

  // Плавно показываем
  const container = document.querySelector('.container');
  container.classList.add('has-result');

  setTimeout(() => {
    resultContainer.style.opacity = '1';
    resultContainer.style.transform = 'translateY(0)';
  }, 100);

  const collapsibleContent = document.querySelector('.section-content');
  if (collapsibleContent) {
    collapsibleContent.style.maxHeight = collapsibleContent.scrollHeight + "px";
  }
}

// Функция уведомления
function showNotification(message) {
  const container = document.querySelector('.container');
  container.classList.remove('has-result');

  const resultContainer = document.getElementById('result');
  resultContainer.style.display = 'none';

  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);

  requestAnimationFrame(() => {
    notification.style.display = 'block';
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 500);
    }, 2000);
  });
}

// Сворачивание/разворачивание секции
function toggleSection(header) {
  const content = header.nextElementSibling;
  header.classList.toggle('collapsed');
  if (content.style.maxHeight) {
    content.style.maxHeight = null;
  } else {
    content.style.maxHeight = content.scrollHeight + "px";
  }
}
