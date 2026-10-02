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

export interface AlternativeCandidate {
  text: string;
  confidence: number;
}

export type FieldAlternativesMap = Record<string, AlternativeCandidate[]>;

export interface OCRResult {
  docName: string;
  docNumber: string;
  product: string;
  validFrom: string;
  validTo: string;
  notes: string;
  productsList?: string[];
  fieldAlternatives?: FieldAlternativesMap;
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

export type FieldKey = 'docName' | 'docNumber' | 'product' | 'validFrom' | 'validTo' | 'notes';

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

export interface OcrHistoryEntry {
  id: string;
  timestamp: number;
  docTitle: string;
  thumbnail?: string;
  pagesCount: number;
  baseVersion: OCRResult;
  currentVersion: OCRResult;
  hasEdits: boolean;
  editedFields: FieldKey[];
}

export interface QuickCopyConfig {
  template: string;
  regexPattern: string;
  regexReplace: string;
}

export interface AppSettingsConfig {
  version: string;
  exportedAt?: string;
  provider: AiProvider;
  model: string;
  customModelId?: string;
  prompts: FieldPrompts;
  quickCopy?: QuickCopyConfig;
}



