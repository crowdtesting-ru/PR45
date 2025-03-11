let excelData = null;
let tg = window.Telegram.WebApp;

tg.ready();

fetch('PR45.xlsx')
    .then(response => {
        if (!response.ok) {
            throw new Error('Ошибка загрузки файла');
        }
        return response.arrayBuffer();
    })
    .then(buffer => {
        const workbook = XLSX.read(buffer, { type: 'array' });
        const distribution = XLSX.utils.sheet_to_json(workbook.Sheets['Распределение']);
        excelData = distribution;
    })
    .catch(error => {
        showNotification('Ошибка загрузки данных. Обратитесь к администратору.');
    });

document.getElementById('searchBtn').addEventListener('click', searchData);

function normalizeString(str) {
    let normalized = str
        .replace(/\s/g, '')
        .toLowerCase()
        .replace(/ё/g, 'е');
    
    return normalized;
}

// Функция для форматирования сценария
function formatScenario(text) {
    if (!text) return '';
    
    let firstNumberFound = false; // Флаг для отслеживания первого "1."
    
    const lines = text.split('\n')
        .map(line => {
            const trimmedLine = line.trim()
                .replace(/^[\s]+/, '') // Убираем точки в начале строки
                .replace(/^\d+\.\s*/, ''); // Убираем цифры с точкой в начале
            return trimmedLine ? `${trimmedLine}` : '';
        })
        .join('\n');
    
    return lines;
}

function searchData() {
    if (!excelData) {
        showNotification('Подождите, данные загружаются...');
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

    const normalizedInput = normalizeString(nameInput);
    
    const foundByName = excelData.find(row => {
        const normalizedName = normalizeString(row['ФИО']);
        return normalizedName === normalizedInput;
    });

    if (!foundByName) {
        showNotification('ФИО не найдено, проверьте правильность заполнения');
        resultContainer.style.display = 'none';
        return;
    }

    const match = excelData.find(row => {
        const normalizedName = normalizeString(row['ФИО']);
        return normalizedName === normalizedInput && row['Компания'] === companyInput;
    });

    if (!match) {
        showNotification(`Для ${nameInput} нет сценария с компанией ${companyInput}`);
        resultContainer.style.display = 'none';
        return;
    }

    const firstScenarioColumn = `${match['Компания']} ${match['Обращение 1']}`;
    const secondScenarioColumn = `${match['Компания']} ${match['Обращение 2']}`;

    const allColumns = Object.keys(excelData[0]);
    const firstScenarioColumnFound = allColumns.find(col => col === firstScenarioColumn);
    const secondScenarioColumnFound = allColumns.find(col => col === secondScenarioColumn);

    let firstScenario = firstScenarioColumnFound ? excelData[0][firstScenarioColumnFound] : null;
    let secondScenario = secondScenarioColumnFound ? excelData[0][secondScenarioColumnFound] : null;

    if (firstScenario) {
        const scenarioNumber = match['Сценарий'];
        let scenarioText = excelData[0][scenarioNumber];
        
        if (scenarioText) {
            let isFirstSection = true;
            scenarioText = scenarioText
                .split('\n')
                .map(line => {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('1.') && isFirstSection) {
                        isFirstSection = false;
                        return `<div style="padding-left: 20px;"><strong>${trimmedLine}</strong></div>`;
                    }
                    return trimmedLine ? `<div style="padding-left: 20px;">${trimmedLine}</div>` : '';
                })
                .join('');
            
            firstScenario = firstScenario.replace(/<Сценарий>/g, `\n\n<i>${scenarioText}</i>`);
        }
    }

    if (secondScenario) {
        const scenarioNumber = match['Сценарий'];
        let scenarioText = excelData[0][scenarioNumber];
        
        if (scenarioText) {
            let isFirstSection = true;
            scenarioText = scenarioText
                .split('\n')
                .map(line => {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('1.') && isFirstSection) {
                        isFirstSection = false;
                        return `<div style="padding-left: 20px;"><strong>${trimmedLine}</strong></div>`;
                    }
                    return trimmedLine ? `<div style="padding-left: 20px;">${trimmedLine}</div>` : '';
                })
                .join('');
            
            secondScenario = secondScenario.replace(/<Сценарий>/g, `\n\n<i>${scenarioText}</i>`);
        }
    }

    // Находим все записи для данного ФИО
    const allEntriesForName = excelData.filter(row => {
        const normalizedName = normalizeString(row['ФИО']);
        return normalizedName === normalizedInput;
    });

    // Формируем список компаний и устройств с жирным шрифтом
    const companiesList = allEntriesForName
        .map(entry => `<strong>${entry['Компания']}</strong> - <strong>${entry['Устройство']}</strong>`)
        .join('\n');

    // Проверяем, является ли выбранная компания МТС
    const isMTS = match['Компания'] === 'МТС';
    const mtsPhone = isMTS ? match['Номер Телефона для МТС'] : '';
    const mtsText = isMTS 
        ? `Для обращения в бота просим вас использоваться номер телефона, <b>который вы указали в анкете</b> при подачи заявки - <b>${mtsPhone}</b>`
        : '';

    // Формируем результат с правильной структурой
    const result = `
        <div style="font-size: 16px; line-height: 1.5; white-space: pre-line;">
Добрый день, <strong>${match['ФИО']}</strong>!

<div class="collapsible-section">
    <div class="section-header" onclick="toggleSection(this)">
        <h3>ИНФОРМАЦИЯ ПО УЧАСТИЮ</h3>
    </div>
    <div class="section-content">
        В проекте ID-PR45 вас отобрали для участие в исследовании сразу нескольких компаний на девайсах следующих Операционных Систем:
        ${companiesList}

        <strong>Важно!</strong>
        Если вы не можете принять участие в исследовании конкретной компании из списка выше - просим сообщить об этом в чат в Телеграм-канале проекта (ID-PR45), чтобы мы успели вовремя найти замену!
    </div>
</div>

<div class="section-divider"></div>

ИССЛЕДОВАНИЕ <strong>${match['Компания']}</strong> БОТОВ

Необходимо будет выполнить обращения в ботов на устройстве с ОС: <strong>${match['Устройство']}</strong>
${mtsText}

<div class="check-section">
    Для <strong>первой</strong> проверки вам необходимо проверить работу <strong>${match['Обращение 1']}а</strong> по следующему сценарию:
    ${formatScenario(firstScenario) || `Не найден сценарий для столбца "${firstScenarioColumn}"`}

    По завершению просим сразу заполнить анкету по ссылке: ССЫЛКА
</div>

<div class="section-divider"></div>

<div class="check-section">
    Для <strong>второй</strong> проверки вам необходимо проверить работу <strong>${match['Обращение 2']}а</strong> по следующему сценарию:
    ${formatScenario(secondScenario) || `Не найден сценарий для столбца "${secondScenarioColumn}"`}

    По завершению просим сразу заполнить анкету по ссылке: ССЫЛКА
</div>

Если вы участвуете в исследовании нескольких компаний, то введите ваши ФИО в поле ввода вверху этой страницы и выберите следующую компанию.</div>`;

    resultContainer.innerHTML = result;
    resultContainer.style.display = 'block';
    
    // Добавляем класс для контейнера и анимируем появление
    const container = document.querySelector('.container');
    container.classList.add('has-result');
    
    // Плавно показываем результат
    setTimeout(() => {
        resultContainer.style.opacity = '1';
        resultContainer.style.transform = 'translateY(0)';
    }, 100);

    // После добавления HTML
    const collapsibleContent = document.querySelector('.section-content');
    if (collapsibleContent) {
        collapsibleContent.style.maxHeight = collapsibleContent.scrollHeight + "px";
    }
}

function showNotification(message) {
    // Возвращаем контейнер в исходное состояние
    const container = document.querySelector('.container');
    container.classList.remove('has-result');
    
    // Скрываем результат
    const resultContainer = document.getElementById('result');
    resultContainer.style.display = 'none';
    
    // Показываем уведомление
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

function toggleSection(header) {
    const content = header.nextElementSibling;
    header.classList.toggle('collapsed');
    
    if (content.style.maxHeight) {
        content.style.maxHeight = null;
    } else {
        content.style.maxHeight = content.scrollHeight + "px";
    }
    
    // Анимируем стрелку
    const arrow = header.querySelector('.arrow');
    arrow.style.transform = content.style.maxHeight ? 'rotate(180deg)' : 'rotate(0)';
} 