import { DeviceLocation } from '@prisma/client';
import { prisma } from '../config/database';

export type LocationWrite = {
  trackerId: string;
  deviceId: string | null;
  latitude: number;
  longitude: number;
  accuracy: number;
  recordedAt: Date;
};

export async function findCurrentLocation(trackerId: string): Promise<DeviceLocation | null> {
  return prisma.deviceLocation.findUnique({ where: { trackerId } });
}

export async function saveLocation(input: LocationWrite): Promise<DeviceLocation> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.deviceLocation.upsert({
      where: { trackerId: input.trackerId },
      create: {
        trackerId: input.trackerId,
        deviceId: input.deviceId,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy,
        recordedAt: input.recordedAt,
      },
      update: {
        deviceId: input.deviceId,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy,
        recordedAt: input.recordedAt,
      },
    });

    await tx.locationSample.create({
      data: {
        trackerId: input.trackerId,
        deviceId: input.deviceId,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy,
        recordedAt: input.recordedAt,
      },
    });

    return current;
  });
}

