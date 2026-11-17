import { z } from 'zod';

const filters = z.object({
  deviceId: z.string().trim().min(1).max(128).optional(),
  schoolId: z.string().trim().min(1).max(64).optional(),
  eventType: z.enum(['ENTER', 'EXIT']).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

function validateRange(query: { from?: string | undefined; to?: string | undefined }, context: z.RefinementCtx): void {
  if (query.from && query.to && new Date(query.from).getTime() > new Date(query.to).getTime()) {
    context.addIssue({ code: 'custom', path: ['from'], message: '`from` must be earlier than or equal to `to`' });
  }
}

export const geofenceEventListQuerySchema = filters.extend({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).superRefine(validateRange);

export const geofenceEventExportQuerySchema = filters.extend({
  limit: z.coerce.number().int().min(1).max(10_000).default(10_000),
}).superRefine(validateRange);

export const geofenceEventIdSchema = z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9:_-]+$/);

export type GeofenceEventListQuery = z.infer<typeof geofenceEventListQuerySchema>;
export type GeofenceEventExportQuery = z.infer<typeof geofenceEventExportQuerySchema>;
