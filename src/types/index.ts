export interface DocPage {
  id: string;
  src: string;
  selected: boolean;
}

export interface SavedDoc {
  id: number;
  name: string;
  number: string;
  product: string;
  validFrom: string;
  validTo: string;
  notes: string;
}

export type AiProvider = 'openrouter' | 'gemini';

export interface ModelPreset {
  id: string;
  name: string;
}

export interface OCRResult {
  docName: string;
  docNumber: string;
  product: string;
  validFrom: string;
  validTo: string;
  notes: string;
}

export type PairingStatus = 'init' | 'ready' | 'connected' | 'error';

export interface ServerInfo {
  status: string;
  version: string;
  port: number;
  primaryIp: string;
  localIps: string[];
  hasServerOpenRouterKey: boolean;
  hasServerGeminiKey: boolean;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

export interface TunnelStatus {
  status: 'stopped' | 'starting' | 'running' | 'error';
  url: string | null;
  error?: string | null;
}

export type ConnectionChannelType = 'local_wifi' | 'stun_p2p' | 'turn_relay' | 'ws_relay' | 'connecting' | 'disconnected';

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
  product: `Найди и извлеки полное наименование продукции/изделия. 
Правила для нескольких моделей:
1. Найди базовое родовое название (например: «Краны шаровые фланцевые», «Кабель силовой», «Клапан обратный»).
2. Если в тексте, сносках или таблице перечислен модельный ряд/серии/типоразмеры (например: 11с67п, 11лс67п, ВЭЛАН-01, АВВГ-П и т.д.), извлеки КАЖДУЮ модель без исключений.
3. Формат записи: «[Родовое название]: [Модель 1], [Модель 2], [Модель 3]...».
4. Запрещено обрезать список многоточием или фразами «и т.д. / и другие».
5. Если в паспорте стоит галочка, точка или серийный номер напротив конкретной строки в таблице исполнений — укажи именно эту выбранную позицию (и в скобках базовое наименование).
6. Не включай сюда адреса заводов и посторонний юридический текст.`,
  validFrom: 'Дата начала действия в формате ДД.ММ.ГГГГ (или дата выдачи документа)',
  validTo: 'Дата окончания действия в формате ДД.ММ.ГГГГ (или срок действия)',
  notes: 'Орган по сертификации, изготовитель, стандарты ГОСТ / ТР ТС, серия или важные условия'
};

export type FieldKey = keyof OCRResult;

export interface RescanFieldParams {
  provider: AiProvider;
  model: string;
  apiKey: string;
  imageBase64: string;
  fieldKey: FieldKey;
  fieldName: string;
  fieldPrompt: string;
}

export interface FieldAlternativesParams {
  provider: AiProvider;
  model: string;
  apiKey: string;
  imageBase64: string;
  fieldKey: FieldKey;
  fieldName: string;
  fieldPrompt: string;
  currentValue: string;
}

export interface FormatTextParams {
  provider: AiProvider;
  model: string;
  apiKey: string;
  text: string;
  instruction: string;
}



