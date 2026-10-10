import { Request, Response } from 'express';
import * as geofenceService from '../services/geofence.service';
import { resolveTracker } from '../utils/actor';
import { sendReceived } from '../utils/apiResponse';
import { AppError } from '../utils/errors';
import { geofenceEventSchema } from '../validators/geofence.validator';

export async function recordGeofenceEvent(req: Request, res: Response): Promise<void> {
  const input = geofenceEventSchema.parse(req.body);
  const idempotencyKey = req.header('idempotency-key');

  if (idempotencyKey !== undefined && idempotencyKey !== input.eventId) {
    throw new AppError(400, 'IDEMPOTENCY_KEY_MISMATCH', 'Idempotency-Key must match eventId');
  }

  const tracker = await resolveTracker(req);
  const event = await geofenceService.recordGeofenceEvent(tracker, input);
  sendReceived(res, event, event.receivedAt, event.duplicate ? 200 : 201);
}
