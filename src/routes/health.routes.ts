import { Router } from 'express';
import { sendMessage } from '../utils/apiResponse';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  sendMessage(res, 'Server is healthy');
});
