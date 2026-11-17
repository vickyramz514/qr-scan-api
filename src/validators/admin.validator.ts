import { z } from 'zod';

export const adminDataQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  schoolId: z.string().trim().min(1).optional(),
  deviceId: z.string().trim().min(1).optional(),
});

export type AdminDataQuery = z.infer<typeof adminDataQuerySchema>;

export const adminDashboardQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  staleMinutes: z.coerce.number().int().min(1).max(1440).default(15),
});

export type AdminDashboardQuery = z.infer<typeof adminDashboardQuerySchema>;

const locationFilters = z.object({
  schoolId: z.string().trim().min(1).optional(),
  deviceId: z.string().trim().min(1).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

function validateLocationRange(query: { from?: string | undefined; to?: string | undefined }, context: z.RefinementCtx): void {
  if (query.from && query.to && new Date(query.from).getTime() > new Date(query.to).getTime()) {
    context.addIssue({ code: 'custom', path: ['from'], message: '`from` must be earlier than or equal to `to`' });
  }
}

export const adminLocationListQuerySchema = locationFilters.superRefine(validateLocationRange);
export const adminDeviceLocationQuerySchema = locationFilters.omit({ deviceId: true }).superRefine(validateLocationRange);

export type AdminLocationListQuery = z.infer<typeof adminLocationListQuerySchema>;
export type AdminDeviceLocationQuery = z.infer<typeof adminDeviceLocationQuerySchema>;
