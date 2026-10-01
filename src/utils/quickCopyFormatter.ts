import { OCRResult } from '../types';

export function formatTextByTemplate(
  ocr: OCRResult,
  templateStr: string,
  regexPattern = '',
  regexReplace = ''
): string {
  if (!templateStr || !templateStr.trim()) {
    templateStr = '{docName} №{docNumber} от {validFrom} — {product}';
  }

  // Replace variables
  let result = templateStr
    .replace(/\{docName\}/gi, (ocr.docName || '').trim())
    .replace(/\{docNumber\}/gi, (ocr.docNumber || '').trim())
    .replace(/\{product\}/gi, (ocr.product || '').trim())
    .replace(/\{validFrom\}/gi, (ocr.validFrom || '').trim())
    .replace(/\{validTo\}/gi, (ocr.validTo || '').trim())
    .replace(/\{notes\}/gi, (ocr.notes || '').trim());

  // Clean empty segments like "от  —" or trailing punctuation
  result = result.replace(/\s+/g, ' ').trim();

  // Apply regex transformation if pattern is provided
  if (regexPattern && regexPattern.trim()) {
    try {
      const rx = new RegExp(regexPattern.trim(), 'gu');
      if (regexReplace !== undefined && regexReplace !== '') {
        result = result.replace(rx, regexReplace).trim();
      } else {
        // Extract mode: find matching parts or groups
        const matches = [...result.matchAll(rx)];
        if (matches.length > 0) {
          const extracted = matches
            .map((m) => (m[1] !== undefined ? m[1] : m[0]))
            .filter(Boolean)
            .join(', ');
          if (extracted) {
            result = extracted.trim();
          }
        }
      }
    } catch (err) {
      console.warn('Invalid regex in quickCopyFormatter:', err);
    }
  }

  return result.trim();
}
