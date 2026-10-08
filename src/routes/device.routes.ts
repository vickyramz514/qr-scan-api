import { Router } from 'express';
import { listDeviceScans, registerDevice } from '../controllers/device.controller';
import { asyncHandler } from '../utils/asyncHandler';

export const deviceRouter = Router();

deviceRouter.post('/', asyncHandler(registerDevice));
deviceRouter.get('/:deviceId/scans', asyncHandler(listDeviceScans));
