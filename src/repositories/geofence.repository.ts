import { GeofenceEvent, GeofenceEventType, Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export type GeofenceWrite = {
  eventId: string;
  schoolId: string;
  deviceId: string | null;
  eventType: GeofenceEventType;
  latitude: number;
  longitude: number;
  accuracy: number;
  eventTime: Date;
};

export async function findGeofenceEvent(eventId: string): Promise<GeofenceEvent | null> {
  return prisma.geofenceEvent.findUnique({ where: { id: eventId } });
}

export async function createGeofenceEvent(
  input: GeofenceWrite,
): Promise<{ event: GeofenceEvent; created: boolean }> {
  try {
    const event = await prisma.geofenceEvent.create({
      data: {
        id: input.eventId,
        schoolId: input.schoolId,
        deviceId: input.deviceId,
        eventType: input.eventType,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy,
        eventTime: input.eventTime,
      },
    });

    return { event, created: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.geofenceEvent.findUnique({ where: { id: input.eventId } });
      if (existing) {
        return { event: existing, created: false };
      }
    }

    throw error;
  }
}
