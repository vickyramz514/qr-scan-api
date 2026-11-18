import { Request } from 'express';
import { findDeviceById } from '../repositories/device.repository';
import { deviceIdSchema } from '../validators/device.validator';
import { AppError } from './errors';

export const UNASSIGNED_TRACKER_ID = 'unassigned';

export type Tracker = {
  trackerId: string;
  deviceId: string | null;
};

export async function resolveTracker(req: Request, bodyDeviceId?: string): Promise<Tracker> {
  const header = req.header('x-device-id');
  const headerDeviceId = header?.trim();

  if (headerDeviceId && bodyDeviceId && headerDeviceId !== bodyDeviceId) {
    throw new AppError(400, 'DEVICE_ID_MISMATCH', 'X-Device-Id must match deviceId');
  }

  const candidate = headerDeviceId || bodyDeviceId;

  if (!candidate) {
    return { trackerId: UNASSIGNED_TRACKER_ID, deviceId: null };
  }

  const parsed = deviceIdSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_DEVICE_ID', 'Invalid device id');
  }

  const device = await findDeviceById(parsed.data);
  if (!device) {
    throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device is not registered');
  }

  return { trackerId: device.deviceId, deviceId: device.deviceId };
}
