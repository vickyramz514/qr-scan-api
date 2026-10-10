import { Router } from 'express';
import { recordLocation } from '../controllers/location.controller';
import { asyncHandler } from '../utils/asyncHandler';

export const locationRouter = Router();

locationRouter.post('/', asyncHandler(recordLocation));
