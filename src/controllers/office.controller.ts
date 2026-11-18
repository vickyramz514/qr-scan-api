import { Request, Response } from 'express';
import * as officeService from '../services/office.service';
import { sendSuccess } from '../utils/apiResponse';

export async function getOffice(req: Request, res: Response): Promise<void> {
  const rawId = req.query.id;
  const officeId = typeof rawId === 'string' ? rawId : undefined;
  sendSuccess(res, await officeService.getOffice(officeId));
}

export async function listOffices(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, await officeService.listOffices());
}
