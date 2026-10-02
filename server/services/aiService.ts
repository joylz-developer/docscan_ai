export interface FieldPrompts {
  docName: string;
  docNumber: string;
  product: string;
  validFrom: string;
  validTo: string;
  notes: string;
}

export const DEFAULT_FIELD_PROMPTS: FieldPrompts = {
  docName: 'Название документа (например: Сертификат соответствия, Декларация, Паспорт изделия, Свидетельство, Акт)',
  docNumber: `Номер документа, паспорта изделия или сертификата.
ГЛАВНОЕ ПРАВИЛО: ЕСЛИ НЕТ НОМЕРА — ПИШИ СТРОГО «б/н»!
Категорически запрещено ставить по умолчанию «1», «№1», «-» или номер страницы/листа!
1. Если у документа нет явного номера (или указано «б/н»), пиши строго «б/н».
2. ВНИМАНИЕ: Если перед тобой ПАСПОРТ изделия (руководство, этикетка, акт):
   - Извлекай ТОЛЬКО заводской/паспортный номер самого изделия или паспорта (например: «Паспорт № 1234», «Заводской №...»).
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО брать номер из раздела «Сертификаты соответствия / Декларация ТР ТС» или сносок о сертификации!
   - Если собственного номера у паспорта нет — пиши строго «б/н».`,
  product: `Найди и извлеки полное наименование продукции/изделия со всеми ключевыми техническими характеристиками и типоразмерами.
ОБЯЗАТЕЛЬНЫЕ правила:
1. Базовое название + конкретный типоразмер:
   - Для труб: обязательно указывай точный наружный диаметр и толщину стенки (например: «Труба стальная бесшовная 133х4,0 мм», марка стали «ст. 20 / 09Г2С», ГОСТ).
   - Для кабелей/проводов: марка и сечение жил (например: «Кабель ВВГнг-LS 3х2,5-0,66»).
   - Для арматуры, фланцев, деталей: диаметр Ду (DN), давление Ру (PN), исполнение (например: «Кран шаровый 11с67п Ду100 Ру16»).
   - Для металлопроката/листов: толщина, размеры, марка сплава.
2. Если в тексте, таблице или приложении перечислен модельный ряд/типоразмеры:
   - Извлеки КАЖДУЮ конкретную модель без исключений.
   - Формат записи: «[Родовое название]: [Модель/размер 1], [Модель/размер 2]...».
   - Запрещено обрезать список многоточием или «и т.д.».
3. Если в паспорте отмечена строка галочкой/точкой/серийным номером — укажи именно эту выбранную позицию с её параметрами.`,
  validFrom: `Дата начала действия или дата выдачи документа.
ВАЖНО:
1. Дата строго в формате ДД.ММ.ГГГГ (например: 15.05.2024). Запрещено писать слова «с», «по», «г.», «года», время. Если даты нет — пустая строка "".
2. Если перед тобой ПАСПОРТ изделия: указывай дату выпуска/изготовления изделия или дату штампа ОТК/приемки паспорта (НЕ дату выдачи сертификата соответствия!).`,
  validTo: `Дата окончания действия документа.
ВАЖНО:
1. Дата строго в формате ДД.ММ.ГГГГ (например: 15.05.2029). Если срок бессрочный — пиши «Бессрочно». Если даты окончания нет — оставляй пустую строку "".
2. Если перед тобой ПАСПОРТ изделия: у паспортов изделий обычно нет срока окончания (он бессрочный или гарантийный). КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО подставлять срок действия сертификата соответствия! Пиши «Бессрочно» или оставляй пустым.`,
  notes: 'Орган по сертификации, изготовитель, стандарты ГОСТ / ТР ТС, серия или важные условия. Если это паспорт изделия — укажи сюда сведения о сертификатах соответствия и ТР ТС.'
};

export function buildOcrPrompt(fields?: Partial<FieldPrompts>, pageCount = 1): string {
  const f = { ...DEFAULT_FIELD_PROMPTS, ...fields };
  const multiPageNotice = pageCount > 1 
    ? `\nВНИМАНИЕ: Передано несколько страниц документа (${pageCount} стр.). Тщательно изучи ВСЕ страницы! Если список материалов, продукции или спецификация продолжается на 2-й, 3-й и следующих страницах (или в таблице приложения), объедини ВСЕ позиции со ВСЕХ страниц в единый полный список!\n`
    : '';

  return `Проанализируй скан документа${pageCount > 1 ? ` (всего ${pageCount} страниц)` : ''} и извлеки данные по следующим правилам и полям:
${multiPageNotice}
1. docName (Название документа):
${f.docName}

2. docNumber (Номер документа / сертификата / паспорта):
${f.docNumber}

3. product (Наименование продукции / материалов / оборудования со спецификацией):
${f.product}

4. validFrom (Дата начала действия / дата выдачи документа):
${f.validFrom}

5. validTo (Дата окончания действия):
${f.validTo}

6. notes (Заметки / Орган сертификации / Стандарты):
${f.notes}

ВАЖНЫЕ ТРЕБОВАНИЯ К ФОРМАТУ ОТВЕТА:
- Для КАЖДОГО поля найди в документе ВСЕ возможные альтернативные варианты (без ограничений по количеству), которые также могут подходить, с приблизительной оценкой соответствия confidence от 50 до 100%.
- Для продукции дополнительно верни массив "productsList" со всеми отдельными позициями (каждое изделие с его типоразмером/характеристиками отдельной строкой).

Верни результат СТРОГО в виде валидного JSON-объекта со следующей структурой:
{
  "docName": "точное название документа",
  "docNumber": "номер или б/н",
  "product": "полное наименование продукции и всех моделей с параметрами",
  "validFrom": "ДД.ММ.ГГГГ или пусто",
  "validTo": "ДД.ММ.ГГГГ, Бессрочно или пусто",
  "notes": "заметки, стандарты и органы сертификации",
  "productsList": [
    "Позиция 1 с параметрами (например: Труба стальная бесшовная 133х4,0 мм ст.20 ГОСТ 8732-78)",
    "Позиция 2 с параметрами"
  ],
  "fieldAlternatives": {
    "docName": [
      { "text": "альтернативное название", "confidence": 92 }
    ],
    "docNumber": [
      { "text": "альтернативный номер", "confidence": 88 }
    ],
    "product": [
      { "text": "альтернативная формулировка или группа", "confidence": 95 }
    ],
    "validFrom": [
      { "text": "альтернативная дата ДД.ММ.ГГГГ", "confidence": 85 }
    ],
    "validTo": [
      { "text": "альтернативная дата", "confidence": 80 }
    ],
    "notes": [
      { "text": "альтернативные заметки", "confidence": 85 }
    ]
  }
}
Отвечай ТОЛЬКО чистым валидным JSON без каких-либо вводных слов, пояснений и без markdown-разметки (\`\`\`json).`;
}

export interface OCRRequestPayload {
  provider: 'openrouter' | 'gemini';
  model: string;
  apiKey?: string;
  imageBase64?: string;
  imagesBase64?: string[];
  customPrompts?: Partial<FieldPrompts>;
}

export interface AlternativeCandidateItem {
  text: string;
  confidence: number;
}

export interface OCRResultData {
  docName: string;
  docNumber: string;
  product: string;
  validFrom: string;
  validTo: string;
  notes: string;
  productsList?: string[];
  fieldAlternatives?: Record<string, AlternativeCandidateItem[]>;
}

export interface RescanFieldPayload {
  provider: 'openrouter' | 'gemini';
  model: string;
  apiKey?: string;
  imageBase64: string;
  fieldKey: string;
  fieldName: string;
  fieldPrompt: string;
}

export interface FieldAlternativesPayload {
  provider: 'openrouter' | 'gemini';
  model: string;
  apiKey?: string;
  imageBase64: string;
  fieldKey: string;
  fieldName: string;
  fieldPrompt: string;
  currentValue: string;
}

export interface FormatTextPayload {
  provider: 'openrouter' | 'gemini';
  model: string;
  apiKey?: string;
  text: string;
  instruction: string;
}

function resolveApiKey(provider: 'openrouter' | 'gemini', providedKey?: string): string {
  const key = providedKey || (provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.GEMINI_API_KEY);
  if (!key) {
    throw new Error(`API ключ для ${provider === 'openrouter' ? 'OpenRouter' : 'Gemini'} не указан. Укажите его в настройках приложения.`);
  }
  return key;
}

export async function testConnection(payload: {
  provider: 'openrouter' | 'gemini';
  model: string;
  apiKey?: string;
}): Promise<{ success: boolean; message: string }> {
  const { provider, model } = payload;
  const apiKey = resolveApiKey(provider, payload.apiKey);

  if (provider === 'openrouter') {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'DocScan AI'
      },
      body: JSON.stringify({
        model: model || 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: 'Ответь одним словом: OK' }],
        max_tokens: 10
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      let msg = errText;
      try {
        const parsed = JSON.parse(errText);
        msg = parsed.error?.message || errText;
      } catch (_) {}
      throw new Error(`OpenRouter HTTP ${res.status}: ${msg}`);
    }

    return { success: true, message: 'Соединение успешно! Модель OpenRouter отвечает.' };
  } else {
    const modelName = model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Ответь одним словом: OK' }] }],
        generationConfig: { maxOutputTokens: 10 }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      let msg = errText;
      try {
        const parsed = JSON.parse(errText);
        msg = parsed.error?.message || errText;
      } catch (_) {}
      throw new Error(`Gemini HTTP ${res.status}: ${msg}`);
    }

    return { success: true, message: 'Соединение успешно! Google Gemini отвечает.' };
  }
}

/**
 * Universal raw completion caller (supports text-only or multimodal vision)
 */
async function callModelRaw(
  provider: 'openrouter' | 'gemini',
  model: string,
  apiKey: string,
  promptText: string,
  images?: string | string[]
): Promise<string> {
  const imagesList: string[] = [];
  if (Array.isArray(images)) {
    imagesList.push(...images.filter(Boolean));
  } else if (images) {
    imagesList.push(images);
  }

  if (provider === 'openrouter') {
    const messagesContent: any[] = [{ type: 'text', text: promptText }];
    for (const img of imagesList) {
      const formattedImageUrl = img.startsWith('data:') 
        ? img 
        : `data:image/jpeg;base64,${img}`;
      messagesContent.push({ type: 'image_url', image_url: { url: formattedImageUrl } });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'DocScan AI'
      },
      body: JSON.stringify({
        model: model || 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: messagesContent }],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let parsedErr = errorText;
      try {
        const jsonErr = JSON.parse(errorText);
        parsedErr = jsonErr.error?.message || errorText;
      } catch (_) {}
      throw new Error(`Ошибка OpenRouter (${response.status}): ${parsedErr}`);
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) {
      throw new Error('Пустой ответ от модели OpenRouter.');
    }
    return rawText;
  } else {
    const parts: any[] = [{ text: promptText }];
    for (const img of imagesList) {
      const cleanBase64 = img.includes(',') ? img.split(',')[1] : img;
      parts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: cleanBase64
        }
      });
    }

    const cleanModel = (model || 'gemini-2.5-flash').replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.1 }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let parsedErr = errorText;
      try {
        const jsonErr = JSON.parse(errorText);
        parsedErr = jsonErr.error?.message || errorText;
      } catch (_) {}
      throw new Error(`Ошибка Gemini API (${response.status}): ${parsedErr}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Пустой ответ от Gemini API.');
    }
    return rawText;
  }
}

export async function processOCR(payload: OCRRequestPayload): Promise<OCRResultData> {
  const { provider, model, imageBase64, imagesBase64, customPrompts } = payload;
  const apiKey = resolveApiKey(provider, payload.apiKey);

  const images: string[] = [];
  if (Array.isArray(imagesBase64) && imagesBase64.length > 0) {
    images.push(...imagesBase64);
  } else if (imageBase64) {
    images.push(imageBase64);
  }

  if (images.length === 0) {
    throw new Error('Не переданы изображения для распознавания');
  }

  const prompt = buildOcrPrompt(customPrompts, images.length);
  const rawText = await callModelRaw(provider, model, apiKey, prompt, images);
  return parseJsonResponse(rawText);
}

/**
 * Rescans a single field with high precision
 */
export async function rescanSingleField(payload: RescanFieldPayload): Promise<string> {
  const { provider, model, imageBase64, fieldName, fieldPrompt } = payload;
  const apiKey = resolveApiKey(provider, payload.apiKey);

  const prompt = `Проанализируй скан документа и найди точное значение ТОЛЬКО для поля "${fieldName}".
Инструкция и требования к полю:
${fieldPrompt}

Ответь строго в формате JSON:
{
  "value": "найденное точное значение поля"
}
Если данных для этого поля в документе нет, верни: { "value": "" }.
Отвечай ТОЛЬКО валидным JSON без markdown (\`\`\`json) и без пояснений.`;

  const rawText = await callModelRaw(provider, model, apiKey, prompt, imageBase64);
  const cleaned = cleanJsonString(rawText);

  try {
    const parsed = JSON.parse(cleaned);
    let val = typeof parsed.value === 'string' ? parsed.value : String(parsed.value || '');
    val = val.trim();
    if (fieldName.toLowerCase().includes('номер') || fieldName === 'docNumber') {
      val = normalizeDocNumber(val);
    } else if (fieldName.toLowerCase().includes('дата') || fieldName.includes('valid')) {
      val = normalizeDate(val);
    }
    return val;
  } catch {
    return rawText.trim();
  }
}

/**
 * Finds alternative extracted text candidates for a given field without limitation
 */
export async function findFieldAlternatives(payload: FieldAlternativesPayload): Promise<string[]> {
  const { provider, model, imageBase64, fieldKey, fieldName, fieldPrompt, currentValue } = payload;
  const apiKey = resolveApiKey(provider, payload.apiKey);

  const key = (fieldKey || '').toLowerCase();
  let specificFieldRule = '';

  if (key === 'docnumber' || fieldName.toLowerCase().includes('номер')) {
    specificFieldRule = `СТРОГО ДЛЯ ПОЛЯ "НОМЕР":
- Вариант ОБЯЗАН быть исключительно реальным номером документа, заводским номером изделия или бланка (например: "№ 1234", "Зав. № 9812", "ПС-04-11").
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО возвращать: номера стандартов (ГОСТ, ТУ), ИНН, ОГРН, артикулы, телефоны, адреса, номера страниц, сноски или юридический текст!
- Если других подходящих номеров в документе нет — верни пустой массив [].`;
  } else if (key === 'validfrom' || key === 'validto' || fieldName.toLowerCase().includes('действителен') || fieldName.toLowerCase().includes('дата')) {
    specificFieldRule = `СТРОГО ДЛЯ ДАТЫ:
- Каждый вариант ОБЯЗАН быть календарной датой в формате ДД.ММ.ГГГГ (например: 15.04.2024) или словом «Бессрочно».
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО возвращать годы стандартов (ГОСТ 8732-78), номера сертификатов, количество штук или посторонние цифры!`;
  } else if (key === 'docname' || fieldName.toLowerCase().includes('название')) {
    specificFieldRule = `СТРОГО ДЛЯ НАЗВАНИЯ ДОКУМЕНТА:
- Вариант ОБЯЗАН быть типом/наименованием документа (например: Паспорт, Сертификат соответствия, Декларация, Руководство по эксплуатации, Формуляр, Акт приёмки, Этикетка).
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО возвращать названия компаний, брендов, наименования товаров или адреса!`;
  } else if (key === 'product' || fieldName.toLowerCase().includes('продукц')) {
    specificFieldRule = `СТРОГО ДЛЯ ПРОДУКЦИИ:
- Вариант ОБЯЗАН быть конкретным наименованием изделия, модели или типоразмера (например: «Труба бесшовная 133х4,0 мм ст.20 ГОСТ 8732-78»).
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО включать юридические адреса, гарантийные обязательства, правила транспортировки, ФИО подписантов или абстрактный текст!`;
  }

  const prompt = `Внимательно изучи скан документа. Пользователь ищет ТОЧНЫЕ альтернативные варианты для поля "${fieldName}".
Инструкция/требования к полю:
${fieldPrompt}

Текущее значение поля: "${currentValue || '(пусто)'}".

${specificFieldRule}

ОБЩИЕ ПРАВИЛА:
1. Предлагай ТОЛЬКО такие варианты, которые на 100% логически и семантически соответствуют смыслу поля "${fieldName}".
2. Если в документе НЕТ других реальных кандидатов для этого поля — верни ПУСТОЙ массив: { "alternatives": [] }.
3. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО возвращать случайные обрывки предложений, заголовки таблиц, адреса или посторонний текст документа!
4. Все варианты должны отличаться от текущего значения.

Ответь строго в формате JSON:
{
  "alternatives": [
    "первый подходящий вариант",
    "второй подходящий вариант"
  ]
}
Отвечай ТОЛЬКО валидным JSON без markdown (\`\`\`json) и без лишнего текста.`;

  const rawText = await callModelRaw(provider, model, apiKey, prompt, imageBase64);
  const cleaned = cleanJsonString(rawText);

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed.alternatives)) {
      let list = parsed.alternatives
        .map((item: any) => (typeof item === 'string' ? item : String(item?.text || '')).trim())
        .filter((item: string) => item.length > 0 && item !== currentValue?.trim());

      // Post-filtering by field type
      if (key === 'validfrom' || key === 'validto' || fieldName.toLowerCase().includes('дата')) {
        list = list.map((item: string) => normalizeDate(item)).filter((item: string) => item.length > 0);
      } else if (key === 'docnumber' || fieldName.toLowerCase().includes('номер')) {
        list = list
          .filter((item: string) => item.length <= 60)
          .filter((item: string) => !/(?:тел|факс|адрес|город|улиц|ул\.|ооо|зао|пао|ао\b|инн|огрн)/i.test(item))
          .map((item: string) => normalizeDocNumber(item));
      } else if (key === 'docname') {
        list = list.filter((item: string) => item.length <= 80 && !/(?:тел|факс|адрес|город|улиц|ул\.)/i.test(item));
      }

      // Deduplicate
      return Array.from(new Set(list));
    }
  } catch (e) {
    console.warn('Failed to parse alternatives JSON:', e);
  }

  return [];
}

/**
 * Re-formats long text fields using custom or preset AI prompts
 */
export async function formatTextWithAi(payload: FormatTextPayload): Promise<string> {
  const { provider, model, text, instruction } = payload;
  const apiKey = resolveApiKey(provider, payload.apiKey);

  const prompt = `Ты профессиональный редактор технических и юридических документов.
Отформатируй и приведи в порядок следующий текст согласно инструкции:
"${instruction}"

ВАЖНЫЕ ПРАВИЛА:
1. Сохраняй абсолютно все фактические данные: артикулы, ГОСТы, ТУ, цифры, коды, даты, наименования компаний. Ничего не выдумывай и не удаляй.
2. Исправь опечатки OCR (распознавания текста), лишние случайные переносы строк, склеенные слова.
3. Верни ТОЛЬКО готовый результат форматирования. Без вводных слов ("Вот результат:"), без кавычек и без markdown-блоков (\`\`\`).

Исходный текст для обработки:
${text}`;

  const formatted = await callModelRaw(provider, model, apiKey, prompt);
  return formatted.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
}

function cleanJsonString(text: string): string {
  let cleaned = text.trim();
  if (cleaned.includes('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

function normalizeDocNumber(num: any): string {
  if (!num) return 'б/н';
  const str = String(num).trim();
  if (str === '' || str === '-' || str === '1' || str === '№1' || str === '№ 1' || str.toLowerCase() === 'б/н' || str.toLowerCase() === 'б.н.' || str.toLowerCase() === 'бн') {
    return 'б/н';
  }
  return str;
}

function normalizeDate(val: any): string {
  if (!val) return '';
  let str = String(val).trim();
  if (str.toLowerCase().includes('бессрочн')) return 'Бессрочно';

  // DD.MM.YYYY
  const dotMatch = str.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
  if (dotMatch) {
    const d = dotMatch[1].padStart(2, '0');
    const m = dotMatch[2].padStart(2, '0');
    return `${d}.${m}.${dotMatch[3]}`;
  }

  // YYYY-MM-DD
  const dashMatch = str.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (dashMatch) {
    const d = dashMatch[3].padStart(2, '0');
    const m = dashMatch[2].padStart(2, '0');
    return `${d}.${m}.${dashMatch[1]}`;
  }

  // Clean trailing punctuation or leading prepositions
  str = str.replace(/^[сппоот\s]+/, '').replace(/[\sггода\.]+$/, '').trim();
  return str;
}

function parseJsonResponse(text: string): OCRResultData {
  const cleaned = cleanJsonString(text);

  try {
    const parsed = JSON.parse(cleaned);

    const docName = String(parsed.docName || parsed.name || '').trim();
    const rawNumber = parsed.docNumber || parsed.number || '';
    const docNumber = normalizeDocNumber(rawNumber);
    const product = String(parsed.product || parsed.object || '').trim();
    const validFrom = normalizeDate(parsed.validFrom);
    const validTo = normalizeDate(parsed.validTo);
    const notes = String(parsed.notes || parsed.description || '').trim();

    // Parse productsList (Item 4)
    let productsList: string[] = [];
    if (Array.isArray(parsed.productsList) && parsed.productsList.length > 0) {
      productsList = parsed.productsList.map((p: any) => String(p).trim()).filter(Boolean);
    } else if (product) {
      // Split by newlines, semicolons or numbered items like "1.", "2."
      const lines = product.split(/\r?\n|;|\b\d+[\.\)]\s+/).map(s => s.trim()).filter(s => s.length > 2);
      if (lines.length > 1) {
        productsList = lines;
      } else {
        productsList = [product];
      }
    }

    // Parse fieldAlternatives (Item 6)
    const fieldAlternatives: Record<string, AlternativeCandidateItem[]> = {};
    if (parsed.fieldAlternatives && typeof parsed.fieldAlternatives === 'object') {
      for (const [key, alts] of Object.entries(parsed.fieldAlternatives)) {
        if (Array.isArray(alts)) {
          fieldAlternatives[key] = alts.map((item: any) => {
            if (typeof item === 'string') {
              return { text: item.trim(), confidence: 90 };
            }
            return {
              text: String(item.text || item.value || '').trim(),
              confidence: typeof item.confidence === 'number' ? Math.round(item.confidence) : 90
            };
          }).filter((item: AlternativeCandidateItem) => item.text.length > 0);
        }
      }
    }

    return {
      docName,
      docNumber,
      product,
      validFrom,
      validTo,
      notes,
      productsList,
      fieldAlternatives
    };
  } catch (err) {
    console.warn('Failed to parse strict JSON from model, returning raw notes:', text);
    return {
      docName: 'Распознанный документ',
      docNumber: 'б/н',
      product: 'Не распознано',
      validFrom: '',
      validTo: '',
      notes: text.trim(),
      productsList: [],
      fieldAlternatives: {}
    };
  }
}
