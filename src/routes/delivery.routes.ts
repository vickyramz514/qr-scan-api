import { Router } from 'express';
import { updateDeliveryStatus } from '../controllers/delivery.controller';
import { asyncHandler } from '../utils/asyncHandler';

export const deliveryRouter = Router();

deliveryRouter.post('/:deliveryId/status', asyncHandler(updateDeliveryStatus));
