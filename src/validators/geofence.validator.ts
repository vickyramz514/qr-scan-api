import { z } from 'zod';
import { isPlausibleEventTime } from '../utils/timeWindow';
import { locationSchema } from './location.validator';

const point = locationSchema.pick({ latitude: true, longitude: true, accuracy: true });

export const geofenceEventSchema = point.extend({
  eventId: z
    .string({ required_error: 'Event id is required', invalid_type_error: 'Event id must be a string' })
    .trim()
    .min(8, 'Invalid event id')
    .max(128, 'Invalid event id')
    .regex(/^[A-Za-z0-9:_-]+$/, 'Invalid event id'),
  schoolId: z
    .string({ required_error: 'School id is required', invalid_type_error: 'School id must be a string' })
    .trim()
    .min(1, 'School id is required')
    .max(64, 'Invalid school id')
    .regex(/^[A-Za-z0-9_-]+$/, 'Invalid school id'),
  eventType: z.enum(['ENTER', 'EXIT'], {
    errorMap: () => ({ message: 'Event type must be ENTER or EXIT' }),
  }),
  eventTime: z
    .string({ required_error: 'Event time is required', invalid_type_error: 'Event time must be a string' })
    .datetime({ message: 'Event time must be an ISO-8601 date' })
    .refine(isPlausibleEventTime, 'Event time is outside the accepted window'),
});

export const deliveryIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid delivery id');

export const deliveryStatusSchema = z.object({
  schoolId: geofenceEventSchema.shape.schoolId,
  status: z.enum(
    ['PENDING', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'FITTING_IN_PROGRESS', 'COMPLETED'],
    { errorMap: () => ({ message: 'Invalid delivery status' }) },
  ),
});

export type GeofenceEventInput = z.infer<typeof geofenceEventSchema>;
export type DeliveryStatusInput = z.infer<typeof deliveryStatusSchema>;
