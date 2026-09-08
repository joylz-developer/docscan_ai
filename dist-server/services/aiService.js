export const DEFAULT_FIELD_PROMPTS = {
    docName: 'Название документа (например: Сертификат соответствия, Декларация, Паспорт изделия, Свидетельство, Акт)',
    docNumber: 'Номер документа, сертификата или бланка',
    product: 'Наименование продукции, оборудования, модели или объекта сертификации',
    validFrom: 'Дата начала действия в формате ДД.ММ.ГГГГ (или дата выдачи документа)',
    validTo: 'Дата окончания действия в формате ДД.ММ.ГГГГ (или срок действия)',
    notes: 'Орган по сертификации, изготовитель, стандарты ГОСТ / ТР ТС, серия или важные условия'
};
export function buildOcrPrompt(fields) {
    const f = { ...DEFAULT_FIELD_PROMPTS, ...fields };
    return `Проанализируй скан документа и верни JSON со следующими полями:
{
  "docName": "${f.docName}",
  "docNumber": "${f.docNumber}",
  "product": "${f.product}",
  "validFrom": "${f.validFrom}",
  "validTo": "${f.validTo}",
  "notes": "${f.notes}"
}
Отвечай ТОЛЬКО чистым валидным JSON без каких-либо вводных слов и без markdown-разметки (\`\`\`json).`;
}
function resolveApiKey(provider, providedKey) {
    const key = providedKey || (provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.GEMINI_API_KEY);
    if (!key) {
        throw new Error(`API ключ для ${provider === 'openrouter' ? 'OpenRouter' : 'Gemini'} не указан. Укажите его в настройках приложения.`);
    }
    return key;
}
export async function testConnection(payload) {
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
            }
            catch (_) { }
            throw new Error(`OpenRouter HTTP ${res.status}: ${msg}`);
        }
        return { success: true, message: 'Соединение успешно! Модель OpenRouter отвечает.' };
    }
    else {
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
            }
            catch (_) { }
            throw new Error(`Gemini HTTP ${res.status}: ${msg}`);
        }
        return { success: true, message: 'Соединение успешно! Google Gemini отвечает.' };
    }
}
/**
 * Universal raw completion caller (supports text-only or multimodal vision)
 */
async function callModelRaw(provider, model, apiKey, promptText, imageBase64) {
    if (provider === 'openrouter') {
        const messagesContent = [{ type: 'text', text: promptText }];
        if (imageBase64) {
            const formattedImageUrl = imageBase64.startsWith('data:')
                ? imageBase64
                : `data:image/jpeg;base64,${imageBase64}`;
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
            }
            catch (_) { }
            throw new Error(`Ошибка OpenRouter (${response.status}): ${parsedErr}`);
        }
        const data = await response.json();
        const rawText = data.choices?.[0]?.message?.content;
        if (!rawText) {
            throw new Error('Пустой ответ от модели OpenRouter.');
        }
        return rawText;
    }
    else {
        const parts = [{ text: promptText }];
        if (imageBase64) {
            const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
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
            }
            catch (_) { }
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
export async function processOCR(payload) {
    const { provider, model, imageBase64, customPrompts } = payload;
    const apiKey = resolveApiKey(provider, payload.apiKey);
    const prompt = buildOcrPrompt(customPrompts);
    const rawText = await callModelRaw(provider, model, apiKey, prompt, imageBase64);
    return parseJsonResponse(rawText);
}
/**
 * Rescans a single field with high precision
 */
export async function rescanSingleField(payload) {
    const { provider, model, imageBase64, fieldName, fieldPrompt } = payload;
    const apiKey = resolveApiKey(provider, payload.apiKey);
    const prompt = `Проанализируй скан документа и найди значение ТОЛЬКО для поля "${fieldName}".
Инструкция/требование к полю: "${fieldPrompt}".

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
        return typeof parsed.value === 'string' ? parsed.value : String(parsed.value || '');
    }
    catch {
        return rawText.trim();
    }
}
/**
 * Finds 2-5 alternative extracted text candidates for a given field
 */
export async function findFieldAlternatives(payload) {
    const { provider, model, imageBase64, fieldName, fieldPrompt, currentValue } = payload;
    const apiKey = resolveApiKey(provider, payload.apiKey);
    const prompt = `Внимательно изучи скан документа. Пользователь ищет наиболее подходящее значение для поля "${fieldName}".
Описание/требование к полю: "${fieldPrompt}".
Текущее найденное значение: "${currentValue || '(не найдено)'}".

Найди в документе 2-5 других возможных альтернативных вариантов, фрагментов текста, формулировок, кодов или модификаций, которые также могут подходить для этого поля.
Ответь строго в формате JSON:
{
  "alternatives": [
    "первый альтернативный вариант",
    "второй альтернативный вариант"
  ]
}
Отвечай ТОЛЬКО валидным JSON без markdown (\`\`\`json) и без лишнего текста.`;
    const rawText = await callModelRaw(provider, model, apiKey, prompt, imageBase64);
    const cleaned = cleanJsonString(rawText);
    try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed.alternatives)) {
            return parsed.alternatives.filter((item) => typeof item === 'string' && item.trim().length > 0);
        }
    }
    catch (e) {
        console.warn('Failed to parse alternatives JSON:', e);
    }
    return [];
}
/**
 * Re-formats long text fields using custom or preset AI prompts
 */
export async function formatTextWithAi(payload) {
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
function cleanJsonString(text) {
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
function parseJsonResponse(text) {
    const cleaned = cleanJsonString(text);
    try {
        const parsed = JSON.parse(cleaned);
        return {
            docName: parsed.docName || parsed.name || '',
            docNumber: parsed.docNumber || parsed.number || '',
            product: parsed.product || parsed.object || '',
            validFrom: parsed.validFrom || '',
            validTo: parsed.validTo || '',
            notes: parsed.notes || parsed.description || ''
        };
    }
    catch (err) {
        console.warn('Failed to parse strict JSON from model, returning raw notes:', text);
        return {
            docName: 'Распознанный документ',
            docNumber: '-',
            product: '-',
            validFrom: '-',
            validTo: '-',
            notes: text
        };
    }
}
