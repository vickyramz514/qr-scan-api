import { GeofenceEvent } from '@prisma/client';
import { Prisma } from '@prisma/client';
import * as geofenceRepository from '../repositories/geofence.repository';
import * as schoolRepository from '../repositories/school.repository';
import { Tracker } from '../utils/actor';
import { AppError } from '../utils/errors';
import { GeofenceEventInput } from '../validators/geofence.validator';

export type GeofenceResult = {
  eventId: string;
  schoolId: string;
  deviceId: string | null;
  eventType: 'ENTER' | 'EXIT';
  latitude: number;
  longitude: number;
  accuracy: number;
  eventTime: string;
  receivedAt: string;
  duplicate: boolean;
};

function toResult(event: GeofenceEvent, duplicate: boolean): GeofenceResult {
  return {
    eventId: event.id,
    schoolId: event.schoolId,
    deviceId: event.deviceId,
    eventType: event.eventType,
    latitude: event.latitude,
    longitude: event.longitude,
    accuracy: event.accuracy,
    eventTime: event.eventTime.toISOString(),
    receivedAt: event.receivedAt.toISOString(),
    duplicate,
  };
}

export async function recordGeofenceEvent(
  tracker: Tracker,
  input: GeofenceEventInput,
): Promise<GeofenceResult> {
  const existing = await geofenceRepository.findGeofenceEvent(input.eventId);
  if (existing) {
    return toResult(existing, true);
  }

  const school = await schoolRepository.findSchoolById(input.schoolId);
  if (!school) {
    throw new AppError(404, 'SCHOOL_NOT_FOUND', 'School not found');
  }

  if (!school.active) {
    throw new AppError(409, 'SCHOOL_INACTIVE', 'School geofence is inactive');
  }

  try {
    const created = await geofenceRepository.createGeofenceEvent({
      eventId: input.eventId,
      schoolId: input.schoolId,
      deviceId: tracker.deviceId,
      eventType: input.eventType,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      eventTime: new Date(input.eventTime),
    });

    return toResult(created.event, !created.created);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new AppError(404, 'SCHOOL_NOT_FOUND', 'School not found');
    }

    throw error;
  }
}
