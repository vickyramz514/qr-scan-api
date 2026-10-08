import { Router } from 'express';
import { createScan, getScan, listScans } from '../controllers/scan.controller';
import { asyncHandler } from '../utils/asyncHandler';

export const scanRouter = Router();

scanRouter.post('/', asyncHandler(createScan));
scanRouter.get('/', asyncHandler(listScans));
scanRouter.get('/:id', asyncHandler(getScan));
