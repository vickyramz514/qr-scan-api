import { Router } from 'express';
import { getOffice, listOffices } from '../controllers/office.controller';
import { asyncHandler } from '../utils/asyncHandler';

export const officeRouter = Router();

officeRouter.get('/', asyncHandler(getOffice));
officeRouter.get('/list', asyncHandler(listOffices));
