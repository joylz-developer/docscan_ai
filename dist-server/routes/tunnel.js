import { Router } from 'express';
import { tunnelService } from '../services/tunnelService.js';
export const tunnelRouter = Router();
tunnelRouter.get('/status', (req, res) => {
    return res.json(tunnelService.getStatus());
});
tunnelRouter.post('/start', async (req, res) => {
    const port = Number(process.env.PORT || 3000);
    const status = await tunnelService.start(port);
    return res.json(status);
});
tunnelRouter.post('/stop', (req, res) => {
    const status = tunnelService.stop();
    return res.json(status);
});
