import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AdminDashboardQuery, AdminDataQuery } from '../validators/admin.validator';

type PresenceRow = {
  deviceId: string;
  platform: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  recordedAt: Date;
  receivedAt: Date;
};

function geofencePresenceCondition(): Prisma.Sql {
  return Prisma.sql`EXISTS (
    SELECT 1
    FROM "School" AS s
    WHERE s."active" = true
      AND s."radiusMeters" > 0
      AND 2 * 6371000 * asin(sqrt(LEAST(1,
        POWER(sin(radians((s."latitude" - dl."latitude") / 2)), 2)
        + cos(radians(dl."latitude")) * cos(radians(s."latitude"))
        * POWER(sin(radians((s."longitude" - dl."longitude") / 2)), 2)
      ))) <= s."radiusMeters"
  )`;
}

function pageInfo(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

async function getPresencePage(inside: boolean, page: number, limit: number) {
  const condition = geofencePresenceCondition();
  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<PresenceRow[]>(Prisma.sql`
      SELECT d."deviceId", d."platform", dl."latitude", dl."longitude",
        dl."accuracy", dl."recordedAt", dl."receivedAt"
      FROM "DeviceLocation" AS dl
      INNER JOIN "Device" AS d ON d."deviceId" = dl."deviceId"
      WHERE dl."deviceId" IS NOT NULL AND ${condition} = ${inside}
      ORDER BY dl."recordedAt" DESC, d."deviceId" ASC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `),
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM "DeviceLocation" AS dl
      INNER JOIN "Device" AS d ON d."deviceId" = dl."deviceId"
      WHERE ${condition} = ${inside}
    `),
  ]);
  const total = Number(countRows[0]?.total ?? 0n);
  return { data: rows, pagination: pageInfo(page, limit, total) };
}

export async function getAdminData(query: AdminDataQuery) {
  const { page, limit, schoolId, deviceId } = query;
  const skip = (page - 1) * limit;
  const schoolWhere = schoolId ? { id: schoolId } : { active: true };
  const eventWhere = {
    ...(schoolId ? { schoolId } : {}),
    ...(deviceId ? { deviceId } : {}),
  };
  const locationWhere = deviceId ? { deviceId } : {};

  const [schools, latestEvents, locations, locationTotal, events, eventTotal, deliveries, deliveryTotal] =
    await Promise.all([
      prisma.school.findMany({ where: schoolWhere, orderBy: { name: 'asc' } }),
      prisma.geofenceEvent.findMany({
        where: { ...(schoolId ? { schoolId } : {}), ...(deviceId ? { deviceId } : {}) },
        orderBy: { eventTime: 'desc' },
        distinct: ['schoolId'],
        select: { schoolId: true, eventType: true, eventTime: true, deviceId: true },
      }),
      prisma.locationSample.findMany({
        where: locationWhere,
        orderBy: { recordedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.locationSample.count({ where: locationWhere }),
      prisma.geofenceEvent.findMany({
        where: eventWhere,
        orderBy: { eventTime: 'desc' },
        skip,
        take: limit,
        include: { school: { select: { name: true } } },
      }),
      prisma.geofenceEvent.count({ where: eventWhere }),
      prisma.deliveryStatusEvent.findMany({
        where: {
          ...(schoolId ? { schoolId } : {}),
          ...(deviceId ? { deliverySchool: { deviceId } } : {}),
        },
        orderBy: { changedAt: 'desc' },
        skip,
        take: limit,
        include: {
          deliverySchool: {
            include: {
              delivery: { select: { name: true } },
              school: { select: { name: true } },
            },
          },
        },
      }),
      prisma.deliveryStatusEvent.count({
        where: {
          ...(schoolId ? { schoolId } : {}),
          ...(deviceId ? { deliverySchool: { deviceId } } : {}),
        },
      }),
    ]);

  const presenceBySchool = new Map(latestEvents.map((event) => [event.schoolId, event]));
  const paginated = <T>(data: T[], total: number) => ({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });

  return {
    offices: schools.map((school) => {
      const presence = presenceBySchool.get(school.id);
      return {
        id: school.id,
        name: school.name,
        latitude: school.latitude,
        longitude: school.longitude,
        radiusMeters: school.radiusMeters,
        presence: presence?.eventType === 'ENTER' ? 'PRESENT' : 'ABSENT',
        presenceUpdatedAt: presence?.eventTime ?? null,
        deviceId: presence?.deviceId ?? null,
      };
    }),
    locations: paginated(locations, locationTotal),
    geofenceEvents: paginated(events, eventTotal),
    deliveryStatusHistory: paginated(deliveries, deliveryTotal),
  };
}

export async function getAdminDashboard(query: AdminDashboardQuery) {
  const now = new Date();
  const activeSince = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const staleBefore = new Date(now.getTime() - query.staleMinutes * 60 * 1000);
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const staleDeviceWhere = {
    OR: [{ currentLocation: null }, { currentLocation: { is: { recordedAt: { lt: staleBefore } } } }],
  };

  const [
    totalDevices,
    activeDevices,
    totalSchools,
    configuredGeofences,
    eventGroups,
    latestLocations,
    latestLocationCount,
    staleDevices,
    staleDeviceCount,
    insideGeofenceDevices,
    outsideGeofenceDevices,
  ] = await Promise.all([
    prisma.device.count(),
    prisma.device.count({ where: { lastSeenAt: { gte: activeSince } } }),
    prisma.school.count(),
    prisma.school.count({ where: { active: true, radiusMeters: { gt: 0 } } }),
    prisma.geofenceEvent.groupBy({
      by: ['eventType'],
      where: { eventTime: { gte: startOfToday } },
      _count: { _all: true },
    }),
    prisma.deviceLocation.findMany({
      where: { deviceId: { not: null } },
      orderBy: [{ recordedAt: 'desc' }, { trackerId: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { device: { select: { deviceId: true, platform: true, lastSeenAt: true } } },
    }),
    prisma.deviceLocation.count({ where: { deviceId: { not: null } } }),
    prisma.device.findMany({
      where: staleDeviceWhere,
      orderBy: { lastSeenAt: 'asc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        deviceId: true,
        platform: true,
        lastSeenAt: true,
        currentLocation: {
          select: { latitude: true, longitude: true, accuracy: true, recordedAt: true, receivedAt: true },
        },
      },
    }),
    prisma.device.count({ where: staleDeviceWhere }),
    getPresencePage(true, query.page, query.limit),
    getPresencePage(false, query.page, query.limit),
  ]);

  const eventsByType = new Map(eventGroups.map((group) => [group.eventType, group._count._all]));
  const paginated = <T>(data: T[], total: number) => ({
    data,
    pagination: pageInfo(query.page, query.limit, total),
  });

  return {
    generatedAt: now.toISOString(),
    definitions: {
      activeDeviceWindowHours: 24,
      staleGpsMinutes: query.staleMinutes,
      eventDayTimezone: 'UTC',
      presenceSource: 'latest device GPS location against active school geofences',
    },
    metrics: {
      totalRegisteredDevices: totalDevices,
      activeDevices,
      totalSchools,
      totalConfiguredGeofences: configuredGeofences,
      devicesInsideGeofences: insideGeofenceDevices.pagination.total,
      devicesOutsideGeofences: outsideGeofenceDevices.pagination.total,
      todaysEntryEvents: eventsByType.get('ENTER') ?? 0,
      todaysExitEvents: eventsByType.get('EXIT') ?? 0,
      devicesWithStaleGps: staleDeviceCount,
    },
    latestGpsLocations: paginated(
      latestLocations.map((location) => ({
        deviceId: location.deviceId,
        platform: location.device?.platform ?? null,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        recordedAt: location.recordedAt,
        receivedAt: location.receivedAt,
      })),
      latestLocationCount,
    ),
    devicesInsideGeofences: insideGeofenceDevices,
    devicesOutsideGeofences: outsideGeofenceDevices,
    staleDevices: paginated(staleDevices, staleDeviceCount),
  };
}
