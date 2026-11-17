import { Router } from 'express';
import {
  getAdminDashboard,
  getAdminData,
  getAdminDeviceLocations,
  getAdminLatestLocations,
  getAdminLocationHistory,
} from '../controllers/admin.controller';
import { asyncHandler } from '../utils/asyncHandler';

export const adminRouter = Router();

adminRouter.get('/data', asyncHandler(getAdminData));
adminRouter.get('/dashboard', asyncHandler(getAdminDashboard));
adminRouter.get('/locations/latest', asyncHandler(getAdminLatestLocations));
adminRouter.get('/locations/history', asyncHandler(getAdminLocationHistory));
adminRouter.get('/locations/:deviceId', asyncHandler(getAdminDeviceLocations));
