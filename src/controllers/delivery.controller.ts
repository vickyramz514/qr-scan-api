import { Request, Response } from 'express';
import * as deliveryService from '../services/delivery.service';
import { resolveTracker } from '../utils/actor';
import { sendReceived } from '../utils/apiResponse';
import { AppError } from '../utils/errors';
import { deliveryIdSchema, deliveryStatusSchema } from '../validators/geofence.validator';

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function updateDeliveryStatus(req: Request, res: Response): Promise<void> {
  const parsedId = deliveryIdSchema.safeParse(readParam(req.params.deliveryId));
  if (!parsedId.success) {
    throw new AppError(400, 'INVALID_DELIVERY_ID', 'Invalid delivery id');
  }

  const input = deliveryStatusSchema.parse(req.body);
  const tracker = await resolveTracker(req);
  const status = await deliveryService.updateDeliveryStatus(parsedId.data, tracker, input);
  sendReceived(res, status, status.receivedAt);
}
