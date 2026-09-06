export interface OCRRequestPayload {
  provider: 'openrouter' | 'gemini';
  model: string;
  apiKey?: string;
  imageBase64: string; // data:image/jpeg;base64,... or raw base64
}

export interface OCRResultData {
  docName: string;
  docNumber: string;
  product: string;
  validFrom: string;
  validTo: string;
  notes: string;
}

const OCR_PROMPT = `Проанализируй скан документа и верни JSON со следующими полями:
{
  "docName": "Название документа (например: Сертификат соответствия, Декларация, Свидетельство, Акт)",
  "docNumber": "Номер документа или сертификата",
  "product": "Наименование продукции, оборудования или объекта",
  "validFrom": "Дата начала действия в формате ДД.ММ.ГГГГ",
  "validTo": "Дата окончания действия в формате ДД.ММ.ГГГГ",
  "notes": "Заметки, орган сертификации, стандарт ГОСТ / ТР ТС или важные условия"
}
Отвечай ТОЛЬКО чистым валидным JSON без каких-либо вводных слов и без markdown-разметки.`;

export async function processOCR(payload: OCRRequestPayload): Promise<OCRResultData> {
  const { provider, model, imageBase64 } = payload;
  const apiKey = payload.apiKey || (provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.GEMINI_API_KEY);

  if (!apiKey) {
    throw new Error(`API ключ для ${provider === 'openrouter' ? 'OpenRouter' : 'Gemini'} не указан. Укажите его в настройках приложения.`);
  }

  if (provider === 'openrouter') {
    return await callOpenRouter(model || 'google/gemini-2.5-flash', apiKey, imageBase64);
  } else {
    return await callGemini(model || 'gemini-2.5-flash', apiKey, imageBase64);
  }
}

async function callOpenRouter(model: string, apiKey: string, imageBase64: string): Promise<OCRResultData> {
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
            { type: 'text', text: OCR_PROMPT },
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

async function callGemini(model: string, apiKey: string, imageBase64: string): Promise<OCRResultData> {
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
            { text: OCR_PROMPT },
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
