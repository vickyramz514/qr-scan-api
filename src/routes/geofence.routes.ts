import { Router } from 'express';
import { recordGeofenceEvent } from '../controllers/geofence.controller';
import { asyncHandler } from '../utils/asyncHandler';

export const geofenceRouter = Router();

geofenceRouter.post('/', asyncHandler(recordGeofenceEvent));
