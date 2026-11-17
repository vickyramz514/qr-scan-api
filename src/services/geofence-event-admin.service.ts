import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/errors';
import { GeofenceEventExportQuery, GeofenceEventListQuery } from '../validators/geofence-event-admin.validator';

function makeWhere(query: GeofenceEventListQuery | GeofenceEventExportQuery): Prisma.GeofenceEventWhereInput {
  return {
    ...(query.deviceId ? { deviceId: query.deviceId } : {}),
    ...(query.schoolId ? { schoolId: query.schoolId } : {}),
    ...(query.eventType ? { eventType: query.eventType } : {}),
    ...(query.from || query.to
      ? { eventTime: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } }
      : {}),
  };
}

const includeRelations = {
  device: { select: { deviceId: true, platform: true, appVersion: true } },
  school: { select: { id: true, name: true, latitude: true, longitude: true, radiusMeters: true, geofenceType: true } },
};

export async function listGeofenceEvents(query: GeofenceEventListQuery) {
  const where = makeWhere(query);
  const [data, total] = await Promise.all([
    prisma.geofenceEvent.findMany({
      where,
      include: includeRelations,
      orderBy: [{ eventTime: 'desc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.geofenceEvent.count({ where }),
  ]);
  return {
    data,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function getGeofenceEvent(id: string) {
  const event = await prisma.geofenceEvent.findUnique({ where: { id }, include: includeRelations });
  if (!event) throw new AppError(404, 'GEOFENCE_EVENT_NOT_FOUND', 'Geofence event not found');
  return event;
}

export async function exportGeofenceEvents(query: GeofenceEventExportQuery) {
  const where = makeWhere(query);
  const [events, total] = await Promise.all([
    prisma.geofenceEvent.findMany({
      where,
      include: includeRelations,
      orderBy: [{ eventTime: 'desc' }, { id: 'asc' }],
      take: query.limit,
    }),
    prisma.geofenceEvent.count({ where }),
  ]);
  return { events, total, truncated: total > events.length };
}

function csvCell(value: string | number | null): string {
  let normalized = value === null ? '' : String(value);
  if (typeof value === 'string' && /^[=+@\-\t\r]/.test(normalized)) normalized = `'${normalized}`;
  return `"${normalized.replaceAll('"', '""')}"`;
}

export function geofenceEventsToCsv(events: Awaited<ReturnType<typeof exportGeofenceEvents>>['events']): string {
  const header = [
    'eventId', 'eventType', 'eventTime', 'receivedAt', 'latitude', 'longitude', 'accuracy',
    'deviceId', 'devicePlatform', 'schoolId', 'schoolName',
  ];
  const rows = events.map((event) => [
    event.id,
    event.eventType,
    event.eventTime.toISOString(),
    event.receivedAt.toISOString(),
    event.latitude,
    event.longitude,
    event.accuracy,
    event.device?.deviceId ?? null,
    event.device?.platform ?? null,
    event.school.id,
    event.school.name,
  ].map(csvCell).join(','));
  return `${header.map(csvCell).join(',')}\r\n${rows.join('\r\n')}\r\n`;
}
