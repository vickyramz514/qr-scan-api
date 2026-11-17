import { Request, Response } from 'express';
import * as adminService from '../services/admin.service';
import {
  adminDashboardQuerySchema,
  adminDataQuerySchema,
  adminDeviceLocationQuerySchema,
  adminLocationListQuerySchema,
} from '../validators/admin.validator';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/errors';
import { deviceIdSchema } from '../validators/device.validator';

export async function getAdminData(req: Request, res: Response): Promise<void> {
  const query = adminDataQuerySchema.parse(req.query);
  sendSuccess(res, await adminService.getAdminData(query));
}

export async function getAdminDashboard(req: Request, res: Response): Promise<void> {
  const query = adminDashboardQuerySchema.parse(req.query);
  sendSuccess(res, await adminService.getAdminDashboard(query));
}

export async function getAdminLatestLocations(req: Request, res: Response): Promise<void> {
  const query = adminLocationListQuerySchema.parse(req.query);
  sendSuccess(res, await adminService.getAdminLocations({ ...query, latestPerDevice: true }));
}

export async function getAdminLocationHistory(req: Request, res: Response): Promise<void> {
  const query = adminLocationListQuerySchema.parse(req.query);
  sendSuccess(res, await adminService.getAdminLocations({ ...query, latestPerDevice: false }));
}

export async function getAdminDeviceLocations(req: Request, res: Response): Promise<void> {
  const parsedId = deviceIdSchema.safeParse(req.params.deviceId);
  if (!parsedId.success) {
    throw new AppError(400, 'INVALID_DEVICE_ID', 'Invalid device id');
  }
  const query = adminDeviceLocationQuerySchema.parse(req.query);
  sendSuccess(
    res,
    await adminService.getAdminLocations({ ...query, deviceId: parsedId.data, latestPerDevice: false }),
  );
}
