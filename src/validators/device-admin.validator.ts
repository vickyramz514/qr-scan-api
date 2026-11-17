import { z } from 'zod';
import { deviceIdSchema } from './device.validator';

const platformSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.enum(['android', 'ios']),
);
const appVersionSchema = z.string().trim().min(1).max(32).regex(/^[0-9A-Za-z.+_-]+$/).nullable();
const schoolIdsSchema = z.array(z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/))
  .max(500)
  .refine((ids) => new Set(ids).size === ids.length, 'School ids must be unique');

export const listDevicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  active: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  schoolId: z.string().trim().min(1).max(64).optional(),
  search: z.string().trim().max(128).optional(),
});

export const createDeviceAdminSchema = z.object({
  deviceId: deviceIdSchema,
  platform: platformSchema,
  appVersion: appVersionSchema.optional(),
  schoolIds: schoolIdsSchema.default([]),
});

export const updateDeviceAdminSchema = z.object({
  platform: platformSchema.optional(),
  appVersion: appVersionSchema.optional(),
  schoolIds: schoolIdsSchema.optional(),
}).refine((input) => Object.keys(input).length > 0, 'At least one field must be provided');

export const updateDeviceStatusSchema = z.object({ active: z.boolean() });

export type ListDevicesQuery = z.infer<typeof listDevicesQuerySchema>;
export type CreateDeviceAdminInput = z.infer<typeof createDeviceAdminSchema>;
export type UpdateDeviceAdminInput = z.infer<typeof updateDeviceAdminSchema>;
