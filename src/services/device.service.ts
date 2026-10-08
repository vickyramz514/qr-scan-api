import { Device } from '@prisma/client';
import * as deviceRepository from '../repositories/device.repository';
import { RegisterDeviceInput } from '../validators/device.validator';

export type DeviceResponse = {
  deviceId: string;
  platform: string;
  appVersion: string | null;
  createdAt: string;
  lastSeenAt: string;
};

export function toDeviceResponse(device: Device): DeviceResponse {
  return {
    deviceId: device.deviceId,
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

  if (input.appVersion !== undefined) {
    record.appVersion = input.appVersion;
  }

  const device = await deviceRepository.upsertDevice(record);
  return toDeviceResponse(device);
}
