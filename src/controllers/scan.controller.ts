import { Request, Response } from 'express';
import { sendPaginated, sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/errors';
import * as scanService from '../services/scan.service';
import { createScanSchema, listScansQuerySchema, scanIdSchema } from '../validators/scan.validator';

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function createScan(req: Request, res: Response): Promise<void> {
  const input = createScanSchema.parse(req.body);
  const scan = await scanService.createScan(input);
  sendSuccess(res, scan, 201);
}

export async function listScans(req: Request, res: Response): Promise<void> {
  const query = listScansQuerySchema.parse(req.query);
  const result = await scanService.listScans(query);
  sendPaginated(res, result.data, result.pagination);
}

export async function clearScans(_req: Request, res: Response): Promise<void> {
  const result = await scanService.clearScans();
  sendSuccess(res, result);
}

export async function getScan(req: Request, res: Response): Promise<void> {
  const parsedId = scanIdSchema.safeParse(readParam(req.params.id));

  if (!parsedId.success) {
    throw new AppError(400, 'INVALID_ID', 'Invalid scan id');
  }

  const scan = await scanService.getScan(parsedId.data);
  sendSuccess(res, scan);
}
