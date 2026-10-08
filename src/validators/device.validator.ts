import { z } from 'zod';

export const DEVICE_ID_PATTERN = /^[A-Za-z0-9-]{8,128}$/;

export const deviceIdSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : value),
  z
    .string({
      required_error: 'Device id is required',
      invalid_type_error: 'Device id must be a string',
    })
    .regex(DEVICE_ID_PATTERN, 'Invalid device id'),
);

export const registerDeviceSchema = z.object({
  deviceId: deviceIdSchema,
  platform: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
    z.enum(['android', 'ios'], {
      errorMap: () => ({ message: 'Platform must be android or ios' }),
    }),
  ),
  appVersion: z.preprocess(
    (value) => {
      if (value === undefined || value === null) {
        return undefined;
      }

      return typeof value === 'string' ? value.trim() : value;
    },
    z
      .string({ invalid_type_error: 'App version must be a string' })
      .min(1, 'App version cannot be empty')
      .max(32, 'App version must be at most 32 characters')
      .regex(/^[0-9A-Za-z.+_-]+$/, 'Invalid app version')
      .optional(),
  ),
});

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
