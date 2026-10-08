import { Device } from '@prisma/client';
import { prisma } from '../config/database';

export type UpsertDeviceRecord = {
  deviceId: string;
  platform: string;
  appVersion?: string;
};

export async function findDeviceById(deviceId: string): Promise<Device | null> {
  return prisma.device.findUnique({
    where: { deviceId },
  });
}

export async function upsertDevice(input: UpsertDeviceRecord): Promise<Device> {
  return prisma.device.upsert({
    where: { deviceId: input.deviceId },
    create: {
      deviceId: input.deviceId,
      platform: input.platform,
      appVersion: input.appVersion ?? null,
    },
    update: {
      platform: input.platform,
      lastSeenAt: new Date(),
      ...(input.appVersion !== undefined ? { appVersion: input.appVersion } : {}),
    },
  });
}
