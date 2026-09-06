import { Router, Request, Response } from 'express';
import { tunnelService } from '../services/tunnelService.js';

export const tunnelRouter = Router();

tunnelRouter.get('/status', (req: Request, res: Response) => {
  return res.json(tunnelService.getStatus());
});

tunnelRouter.post('/start', async (req: Request, res: Response) => {
  const port = Number(process.env.PORT || 3000);
  const status = await tunnelService.start(port);
  return res.json(status);
});

tunnelRouter.post('/stop', (req: Request, res: Response) => {
  const status = tunnelService.stop();
  return res.json(status);
});
