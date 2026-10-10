import { DeviceLocation } from '@prisma/client';
import { env } from '../config/env';
import * as locationRepository from '../repositories/location.repository';
import { Tracker } from '../utils/actor';
import { distanceMeters } from '../utils/geo';
import { LocationInput } from '../validators/location.validator';

export type LocationResult = {
  trackerId: string;
  deviceId: string | null;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
  receivedAt: string;
  stored: boolean;
};

function toResult(location: DeviceLocation, stored: boolean, receivedAt = location.receivedAt): LocationResult {
  return {
    trackerId: location.trackerId,
    deviceId: location.deviceId,
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    timestamp: location.recordedAt.toISOString(),
    receivedAt: receivedAt.toISOString(),
    stored,
  };
}

function isInsignificant(current: DeviceLocation, input: LocationInput): boolean {
  const recordedAt = new Date(input.timestamp);
  if (recordedAt.getTime() <= current.recordedAt.getTime()) {
    return true;
  }

  const elapsed = recordedAt.getTime() - current.recordedAt.getTime();
  const moved = distanceMeters(current, input);
  return moved < env.LOCATION_MIN_MOVE_METERS && elapsed < env.LOCATION_MIN_INTERVAL_MS;
}

export async function recordLocation(tracker: Tracker, input: LocationInput): Promise<LocationResult> {
  const current = await locationRepository.findCurrentLocation(tracker.trackerId);
  const receivedAt = new Date();

  if (current && isInsignificant(current, input)) {
    return toResult(current, false, receivedAt);
  }

  const saved = await locationRepository.saveLocation({
    trackerId: tracker.trackerId,
    deviceId: tracker.deviceId,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy,
    recordedAt: new Date(input.timestamp),
  });

  return toResult(saved, true);
}
