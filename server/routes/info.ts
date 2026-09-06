import { Router, Request, Response } from 'express';
import { getLocalIpAddresses, getPrimaryLocalIp } from '../utils/network.js';

export const infoRouter = Router();

infoRouter.get('/', (req: Request, res: Response) => {
  const port = process.env.PORT || 3000;
  const localIps = getLocalIpAddresses();
  const primaryIp = getPrimaryLocalIp();

  return res.json({
    status: 'ok',
    version: '1.0.0',
    port,
    primaryIp,
    localIps,
    hasServerOpenRouterKey: Boolean(process.env.OPENROUTER_API_KEY),
    hasServerGeminiKey: Boolean(process.env.GEMINI_API_KEY)
  });
});
