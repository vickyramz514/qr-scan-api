import { Request, Response } from 'express';
import * as locationService from '../services/location.service';
import { resolveTracker } from '../utils/actor';
import { sendReceived } from '../utils/apiResponse';
import { locationSchema } from '../validators/location.validator';

export async function recordLocation(req: Request, res: Response): Promise<void> {
  const input = locationSchema.parse(req.body);
  const tracker = await resolveTracker(req);
  const location = await locationService.recordLocation(tracker, input);
  sendReceived(res, location, location.receivedAt);
}
