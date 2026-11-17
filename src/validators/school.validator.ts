import { z } from 'zod';
import { deviceIdSchema } from './device.validator';

const coordinate = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

const circleGeofenceSchema = z.object({
  type: z.literal('CIRCLE'),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  radiusMeters: z.number().int().min(1).max(100_000),
});

function orientation(a: z.infer<typeof coordinate>, b: z.infer<typeof coordinate>, c: z.infer<typeof coordinate>): number {
  return (b.longitude - a.longitude) * (c.latitude - a.latitude)
    - (b.latitude - a.latitude) * (c.longitude - a.longitude);
}

function onSegment(a: z.infer<typeof coordinate>, b: z.infer<typeof coordinate>, point: z.infer<typeof coordinate>): boolean {
  return (
    Math.min(a.longitude, b.longitude) <= point.longitude && point.longitude <= Math.max(a.longitude, b.longitude)
    && Math.min(a.latitude, b.latitude) <= point.latitude && point.latitude <= Math.max(a.latitude, b.latitude)
  );
}

function segmentsIntersect(a: z.infer<typeof coordinate>, b: z.infer<typeof coordinate>, c: z.infer<typeof coordinate>, d: z.infer<typeof coordinate>): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);

  if (((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))) {
    return true;
  }
  return (abC === 0 && onSegment(a, b, c))
    || (abD === 0 && onSegment(a, b, d))
    || (cdA === 0 && onSegment(c, d, a))
    || (cdB === 0 && onSegment(c, d, b));
}

const polygonGeofenceSchema = z.object({
  type: z.literal('POLYGON'),
  coordinates: z.array(coordinate).min(3).max(200),
}).superRefine(({ coordinates }, context) => {
  const unique = new Set(coordinates.map(({ latitude, longitude }) => `${latitude},${longitude}`));
  if (unique.size !== coordinates.length) {
    context.addIssue({ code: 'custom', path: ['coordinates'], message: 'Polygon vertices must be unique; do not repeat the first point at the end' });
    return;
  }

  let twiceArea = 0;
  coordinates.forEach((point, index) => {
    const next = coordinates[(index + 1) % coordinates.length];
    if (next && point.latitude === next.latitude && point.longitude === next.longitude) {
      context.addIssue({ code: 'custom', path: ['coordinates', index], message: 'Adjacent polygon vertices must be different' });
    }
    if (next) twiceArea += point.longitude * next.latitude - next.longitude * point.latitude;
  });
  if (Math.abs(twiceArea) < 1e-12) {
    context.addIssue({ code: 'custom', path: ['coordinates'], message: 'Polygon vertices must enclose a non-zero area' });
  }

  for (let first = 0; first < coordinates.length; first += 1) {
    const firstNext = (first + 1) % coordinates.length;
    for (let second = first + 1; second < coordinates.length; second += 1) {
      const secondNext = (second + 1) % coordinates.length;
      if (first === second || firstNext === second || secondNext === first) continue;
      const a = coordinates[first];
      const b = coordinates[firstNext];
      const c = coordinates[second];
      const d = coordinates[secondNext];
      if (a && b && c && d && segmentsIntersect(a, b, c, d)) {
        context.addIssue({ code: 'custom', path: ['coordinates', second], message: 'Polygon edges must not intersect' });
      }
    }
  }
});

const geofenceSchema = z.union([circleGeofenceSchema, polygonGeofenceSchema]);
const schoolId = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);
const schoolName = z.string().trim().min(1).max(120);
const address = z.string().trim().max(300).nullable().optional();
const deviceIds = z.array(deviceIdSchema).max(500).refine((ids) => new Set(ids).size === ids.length, 'Device ids must be unique');

export const createSchoolSchema = z.object({
  id: schoolId,
  name: schoolName,
  address,
  active: z.boolean().default(true),
  geofence: geofenceSchema,
  deviceIds: deviceIds.default([]),
});

export const updateSchoolSchema = z.object({
  name: schoolName.optional(),
  address,
  active: z.boolean().optional(),
  geofence: geofenceSchema.optional(),
  deviceIds: deviceIds.optional(),
}).refine((input) => Object.keys(input).length > 0, 'At least one field must be provided');

export const listSchoolsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  active: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  search: z.string().trim().max(120).optional(),
});

export const schoolIdSchema = schoolId;

export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
export type ListSchoolsQuery = z.infer<typeof listSchoolsQuerySchema>;
export type GeofenceInput = z.infer<typeof geofenceSchema>;
