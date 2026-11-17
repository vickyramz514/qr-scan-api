import { Router } from 'express';
import { getAdminDashboard, getAdminData } from '../controllers/admin.controller';
import { asyncHandler } from '../utils/asyncHandler';

export const adminRouter = Router();

adminRouter.get('/data', asyncHandler(getAdminData));
adminRouter.get('/dashboard', asyncHandler(getAdminDashboard));
