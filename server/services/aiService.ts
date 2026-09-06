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
  docNumber: 'Номер документа, сертификата или бланка',
  product: 'Наименование продукции, оборудования, модели или объекта сертификации',
  validFrom: 'Дата начала действия в формате ДД.ММ.ГГГГ (или дата выдачи документа)',
  validTo: 'Дата окончания действия в формате ДД.ММ.ГГГГ (или срок действия)',
  notes: 'Орган по сертификации, изготовитель, стандарты ГОСТ / ТР ТС, серия или важные условия'
};

export function buildOcrPrompt(fields?: Partial<FieldPrompts>): string {
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

export interface OCRRequestPayload {
  provider: 'openrouter' | 'gemini';
  model: string;
  apiKey?: string;
  imageBase64: string; // data:image/jpeg;base64,... or raw base64
  customPrompts?: Partial<FieldPrompts>;
}

export interface OCRResultData {
  docName: string;
  docNumber: string;
  product: string;
  validFrom: string;
  validTo: string;
  notes: string;
}

export async function testConnection(payload: {
  provider: 'openrouter' | 'gemini';
  model: string;
  apiKey?: string;
}): Promise<{ success: boolean; message: string }> {
  const { provider, model } = payload;
  const apiKey = payload.apiKey || (provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.GEMINI_API_KEY);

  if (!apiKey) {
    throw new Error(`API ключ для ${provider === 'openrouter' ? 'OpenRouter' : 'Gemini'} не указан`);
  }

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

export async function processOCR(payload: OCRRequestPayload): Promise<OCRResultData> {
  const { provider, model, imageBase64, customPrompts } = payload;
  const apiKey = payload.apiKey || (provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.GEMINI_API_KEY);

  if (!apiKey) {
    throw new Error(`API ключ для ${provider === 'openrouter' ? 'OpenRouter' : 'Gemini'} не указан. Укажите его в настройках приложения.`);
  }

  const prompt = buildOcrPrompt(customPrompts);

  if (provider === 'openrouter') {
    return await callOpenRouter(model || 'google/gemini-2.5-flash', apiKey, imageBase64, prompt);
  } else {
    return await callGemini(model || 'gemini-2.5-flash', apiKey, imageBase64, prompt);
  }
}

async function callOpenRouter(model: string, apiKey: string, imageBase64: string, promptText: string): Promise<OCRResultData> {
  const formattedImageUrl = imageBase64.startsWith('data:') 
    ? imageBase64 
    : `data:image/jpeg;base64,${imageBase64}`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'DocScan AI'
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: promptText },
            { type: 'image_url', image_url: { url: formattedImageUrl } }
          ]
        }
      ],
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

  return parseJsonResponse(rawText);
}

async function callGemini(model: string, apiKey: string, imageBase64: string, promptText: string): Promise<OCRResultData> {
  const cleanBase64 = imageBase64.includes(',') 
    ? imageBase64.split(',')[1] 
    : imageBase64;

  const cleanModel = model.replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: cleanBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1
      }
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

  return parseJsonResponse(rawText);
}

function parseJsonResponse(text: string): OCRResultData {
  let cleaned = text.trim();

  // Strip markdown ```json ... ``` blocks
  if (cleaned.includes('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  // Find first { and last } if extra commentary exists
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

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
  } catch (err) {
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
