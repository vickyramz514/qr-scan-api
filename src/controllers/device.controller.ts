import { Request, Response } from 'express';
import { sendPaginated, sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/errors';
import * as deviceService from '../services/device.service';
import * as scanService from '../services/scan.service';
import { deviceIdSchema, registerDeviceSchema } from '../validators/device.validator';
import { listScansQuerySchema } from '../validators/scan.validator';

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function registerDevice(req: Request, res: Response): Promise<void> {
  const input = registerDeviceSchema.parse(req.body);
  const device = await deviceService.registerDevice(input);
  sendSuccess(res, device);
}

export async function listDeviceScans(req: Request, res: Response): Promise<void> {
  const parsedId = deviceIdSchema.safeParse(readParam(req.params.deviceId));

  if (!parsedId.success) {
    throw new AppError(400, 'INVALID_DEVICE_ID', 'Invalid device id');
  }

  const query = listScansQuerySchema.parse(req.query);
  const result = await scanService.listDeviceScans(parsedId.data, query);
  sendPaginated(res, result.data, result.pagination);
}
