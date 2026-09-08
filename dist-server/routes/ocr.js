import { Router } from 'express';
import { processOCR, testConnection, rescanSingleField, findFieldAlternatives, formatTextWithAi, DEFAULT_FIELD_PROMPTS } from '../services/aiService.js';
export const ocrRouter = Router();
ocrRouter.get('/prompts', (req, res) => {
    return res.json({
        success: true,
        defaults: DEFAULT_FIELD_PROMPTS
    });
});
ocrRouter.post('/test', async (req, res) => {
    try {
        const { provider, model, apiKey } = req.body;
        if (!provider || !['openrouter', 'gemini'].includes(provider)) {
            return res.status(400).json({ success: false, error: 'Укажите корректного провайдера (openrouter или gemini)' });
        }
        const result = await testConnection({ provider, model, apiKey });
        return res.json(result);
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            error: error.message || 'Ошибка соединения с нейросетью'
        });
    }
});
ocrRouter.post('/', async (req, res) => {
    try {
        const { provider, model, apiKey, imageBase64, customPrompts } = req.body;
        if (!imageBase64) {
            return res.status(400).json({ error: 'Изображение не передано (imageBase64)' });
        }
        if (!provider || !['openrouter', 'gemini'].includes(provider)) {
            return res.status(400).json({ error: 'Неверный провайдер. Допустимо: openrouter или gemini' });
        }
        const result = await processOCR({
            provider,
            model: model || (provider === 'openrouter' ? 'google/gemini-2.5-flash' : 'gemini-2.5-flash'),
            apiKey,
            imageBase64,
            customPrompts
        });
        return res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('OCR Route Error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'Ошибка обработки OCR на сервере'
        });
    }
});
ocrRouter.post('/rescan-field', async (req, res) => {
    try {
        const { provider, model, apiKey, imageBase64, fieldKey, fieldName, fieldPrompt } = req.body;
        if (!imageBase64) {
            return res.status(400).json({ error: 'Изображение не передано' });
        }
        if (!provider || !['openrouter', 'gemini'].includes(provider)) {
            return res.status(400).json({ error: 'Неверный провайдер' });
        }
        const value = await rescanSingleField({
            provider,
            model: model || (provider === 'openrouter' ? 'google/gemini-2.5-flash' : 'gemini-2.5-flash'),
            apiKey,
            imageBase64,
            fieldKey,
            fieldName: fieldName || fieldKey,
            fieldPrompt: fieldPrompt || ''
        });
        return res.json({
            success: true,
            value
        });
    }
    catch (error) {
        console.error('Rescan field error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'Ошибка точечного пересканирования поля'
        });
    }
});
ocrRouter.post('/alternatives', async (req, res) => {
    try {
        const { provider, model, apiKey, imageBase64, fieldKey, fieldName, fieldPrompt, currentValue } = req.body;
        if (!imageBase64) {
            return res.status(400).json({ error: 'Изображение не передано' });
        }
        const alternatives = await findFieldAlternatives({
            provider,
            model: model || (provider === 'openrouter' ? 'google/gemini-2.5-flash' : 'gemini-2.5-flash'),
            apiKey,
            imageBase64,
            fieldKey,
            fieldName: fieldName || fieldKey,
            fieldPrompt: fieldPrompt || '',
            currentValue: currentValue || ''
        });
        return res.json({
            success: true,
            alternatives
        });
    }
    catch (error) {
        console.error('Alternatives error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'Ошибка поиска альтернативных вариантов'
        });
    }
});
ocrRouter.post('/format-text', async (req, res) => {
    try {
        const { provider, model, apiKey, text, instruction } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Текст для форматирования пуст' });
        }
        if (!instruction || !instruction.trim()) {
            return res.status(400).json({ error: 'Инструкция для форматирования не указана' });
        }
        const formattedText = await formatTextWithAi({
            provider,
            model: model || (provider === 'openrouter' ? 'google/gemini-2.5-flash' : 'gemini-2.5-flash'),
            apiKey,
            text,
            instruction
        });
        return res.json({
            success: true,
            formattedText
        });
    }
    catch (error) {
        console.error('Format text error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'Ошибка форматирования текста нейросетью'
        });
    }
});
