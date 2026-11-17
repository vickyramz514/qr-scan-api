import { z } from 'zod';

export const adminDataQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  schoolId: z.string().trim().min(1).optional(),
  deviceId: z.string().trim().min(1).optional(),
});

export type AdminDataQuery = z.infer<typeof adminDataQuerySchema>;
