import { Router } from 'express';
import { getAdminData } from '../controllers/admin.controller';
import { asyncHandler } from '../utils/asyncHandler';

export const adminRouter = Router();

adminRouter.get('/data', asyncHandler(getAdminData));
