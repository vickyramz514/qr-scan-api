import { Router } from 'express';
import { clearScans, createScan, getScan, listScans } from '../controllers/scan.controller';
import { asyncHandler } from '../utils/asyncHandler';

export const scanRouter = Router();

scanRouter.post('/', asyncHandler(createScan));
scanRouter.get('/', asyncHandler(listScans));
scanRouter.delete('/', asyncHandler(clearScans));
scanRouter.get('/:id', asyncHandler(getScan));
