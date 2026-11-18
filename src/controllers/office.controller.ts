import { Request, Response } from 'express';
import * as officeService from '../services/office.service';
import { sendSuccess } from '../utils/apiResponse';

export async function getOffice(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, await officeService.getOffice());
}
