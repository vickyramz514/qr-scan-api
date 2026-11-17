import { Request, Response } from 'express';
import * as adminService from '../services/admin.service';
import { adminDataQuerySchema } from '../validators/admin.validator';
import { sendSuccess } from '../utils/apiResponse';

export async function getAdminData(req: Request, res: Response): Promise<void> {
  const query = adminDataQuerySchema.parse(req.query);
  sendSuccess(res, await adminService.getAdminData(query));
}
