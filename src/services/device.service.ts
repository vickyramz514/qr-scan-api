import { Device } from '@prisma/client';
import * as deviceRepository from '../repositories/device.repository';
import { RegisterDeviceInput } from '../validators/device.validator';
import { AppError } from '../utils/errors';

export type DeviceResponse = {
  deviceId: string;
  deviceName: string | null;
  platform: string;
  appVersion: string | null;
  createdAt: string;
  lastSeenAt: string;
};

export function toDeviceResponse(device: Device): DeviceResponse {
  return {
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    platform: device.platform,
    appVersion: device.appVersion,
    createdAt: device.createdAt.toISOString(),
    lastSeenAt: device.lastSeenAt.toISOString(),
  };
}

export async function registerDevice(input: RegisterDeviceInput): Promise<DeviceResponse> {
  const record: deviceRepository.UpsertDeviceRecord = {
    deviceId: input.deviceId,
    platform: input.platform,
  };

  if (input.deviceName !== undefined) {
    record.deviceName = input.deviceName;
  }

  if (input.appVersion !== undefined) {
    record.appVersion = input.appVersion;
  }

  const device = await deviceRepository.upsertDevice(record);
  return toDeviceResponse(device);
}

export async function getRegisteredDevice(deviceId: string): Promise<DeviceResponse> {
  const device = await deviceRepository.findDeviceById(deviceId);
  if (!device) {
    throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device is not registered');
  }
  return toDeviceResponse(device);
}
