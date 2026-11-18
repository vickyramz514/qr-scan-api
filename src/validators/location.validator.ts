import { z } from 'zod';
import { DEVICE_ID_PATTERN } from './device.validator';
import { isPlausibleEventTime } from '../utils/timeWindow';

const coordinate = {
  latitude: z
    .number({ invalid_type_error: 'Latitude must be a number' })
    .finite()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z
    .number({ invalid_type_error: 'Longitude must be a number' })
    .finite()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  accuracy: z
    .number({ invalid_type_error: 'Accuracy must be a number' })
    .finite()
    .min(0, 'Accuracy cannot be negative')
    .max(10_000, 'Accuracy must be at most 10000 metres'),
};

export const locationSchema = z.object({
  deviceId: z.string().trim().regex(DEVICE_ID_PATTERN, 'Invalid device id').optional(),
  deviceName: z.string().trim().min(1, 'Device name cannot be empty').max(128, 'Device name must be at most 128 characters').optional(),
  ...coordinate,
  timestamp: z
    .string({ required_error: 'Timestamp is required', invalid_type_error: 'Timestamp must be a string' })
    .datetime({ message: 'Timestamp must be an ISO-8601 date' })
    .refine(isPlausibleEventTime, 'Timestamp is outside the accepted window'),
});

export type LocationInput = z.infer<typeof locationSchema>;
