import { Router } from 'express';
import { processOCR, testConnection, DEFAULT_FIELD_PROMPTS } from '../services/aiService.js';
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
