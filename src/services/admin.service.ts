import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import {
  AdminDashboardQuery,
  AdminDataQuery,
} from '../validators/admin.validator';
import { AppError } from '../utils/errors';

type PresenceRow = {
  deviceId: string;
  platform: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  recordedAt: Date;
  receivedAt: Date;
};

type AdminLocationRow = {
  id: string;
  trackerId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  recordedAt: Date;
  receivedAt: Date;
  deviceId: string;
  platform: string;
  appVersion: string | null;
  deviceLastSeenAt: Date;
  schoolId: string | null;
  schoolName: string | null;
  schoolLatitude: number | null;
  schoolLongitude: number | null;
  schoolRadiusMeters: number | null;
  schoolAddress: string | null;
  schoolGeofenceType: string | null;
  schoolPolygonCoordinates: Prisma.JsonValue | null;
};

type AdminLocationFilters = {
  schoolId?: string | undefined;
  deviceId?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  page: number;
  limit: number;
  latestPerDevice: boolean;
};

function geofencePresenceCondition(): Prisma.Sql {
  const polygonContainsPoint = (latitude: Prisma.Sql, longitude: Prisma.Sql) => Prisma.sql`EXISTS (
    SELECT 1 FROM (
      SELECT SUM(CASE
        WHEN ((vertices."y1" > ${latitude}) <> (vertices."y2" > ${latitude}))
          AND (${longitude} < (vertices."x2" - vertices."x1") * (${latitude} - vertices."y1") / NULLIF(vertices."y2" - vertices."y1", 0) + vertices."x1")
        THEN 1 ELSE 0 END) AS crossings
      FROM generate_series(0, jsonb_array_length(s."polygonCoordinates") - 1) AS edge(i)
      CROSS JOIN LATERAL (
        SELECT
          (s."polygonCoordinates" -> edge.i ->> 'longitude')::double precision AS "x1",
          (s."polygonCoordinates" -> edge.i ->> 'latitude')::double precision AS "y1",
          (s."polygonCoordinates" -> ((edge.i + 1) % jsonb_array_length(s."polygonCoordinates")) ->> 'longitude')::double precision AS "x2",
          (s."polygonCoordinates" -> ((edge.i + 1) % jsonb_array_length(s."polygonCoordinates")) ->> 'latitude')::double precision AS "y2"
      ) AS vertices
    ) AS crossings
    WHERE crossings.crossings % 2 = 1
  )`;
  return Prisma.sql`EXISTS (
    SELECT 1
    FROM "School" AS s
    WHERE s."active" = true
      AND (
        (s."geofenceType" = 'CIRCLE' AND s."radiusMeters" > 0 AND 2 * 6371000 * asin(sqrt(LEAST(1,
          POWER(sin(radians((s."latitude" - dl."latitude") / 2)), 2)
          + cos(radians(dl."latitude")) * cos(radians(s."latitude"))
          * POWER(sin(radians((s."longitude" - dl."longitude") / 2)), 2)
        ))) <= s."radiusMeters")
        OR (s."geofenceType" = 'POLYGON' AND ${polygonContainsPoint(Prisma.sql`dl."latitude"`, Prisma.sql`dl."longitude"`)})
      )
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

function locationBaseQuery(filters: AdminLocationFilters): Prisma.Sql {
  const where: Prisma.Sql[] = [Prisma.sql`ls."deviceId" IS NOT NULL`];
  if (filters.deviceId) where.push(Prisma.sql`ls."deviceId" = ${filters.deviceId}`);
  if (filters.from) where.push(Prisma.sql`ls."recordedAt" >= ${new Date(filters.from)}`);
  if (filters.to) where.push(Prisma.sql`ls."recordedAt" <= ${new Date(filters.to)}`);

  const selection = filters.latestPerDevice
    ? Prisma.sql`SELECT DISTINCT ON (ls."deviceId") ls.* FROM "LocationSample" AS ls WHERE ${Prisma.join(where, ' AND ')} ORDER BY ls."deviceId", ls."recordedAt" DESC, ls."receivedAt" DESC`
    : Prisma.sql`SELECT ls.* FROM "LocationSample" AS ls WHERE ${Prisma.join(where, ' AND ')}`;
  return Prisma.sql`WITH "filteredLocations" AS (${selection})`;
}

function polygonContainsLocation(): Prisma.Sql {
  return Prisma.sql`EXISTS (
    SELECT 1 FROM (
      SELECT SUM(CASE
        WHEN ((vertices."y1" > fl."latitude") <> (vertices."y2" > fl."latitude"))
          AND (fl."longitude" < (vertices."x2" - vertices."x1") * (fl."latitude" - vertices."y1") / NULLIF(vertices."y2" - vertices."y1", 0) + vertices."x1")
        THEN 1 ELSE 0 END) AS crossings
      FROM generate_series(0, jsonb_array_length(s."polygonCoordinates") - 1) AS edge(i)
      CROSS JOIN LATERAL (
        SELECT
          (s."polygonCoordinates" -> edge.i ->> 'longitude')::double precision AS "x1",
          (s."polygonCoordinates" -> edge.i ->> 'latitude')::double precision AS "y1",
          (s."polygonCoordinates" -> ((edge.i + 1) % jsonb_array_length(s."polygonCoordinates")) ->> 'longitude')::double precision AS "x2",
          (s."polygonCoordinates" -> ((edge.i + 1) % jsonb_array_length(s."polygonCoordinates")) ->> 'latitude')::double precision AS "y2"
      ) AS vertices
    ) AS crossings
    WHERE crossings.crossings % 2 = 1
  )`;
}

function schoolLateralJoin(schoolId?: string): Prisma.Sql {
  const schoolFilter = schoolId ? Prisma.sql`AND s."id" = ${schoolId}` : Prisma.empty;
  return Prisma.sql`LEFT JOIN LATERAL (
    SELECT s."id", s."name", s."latitude", s."longitude", s."radiusMeters", s."address", s."geofenceType", s."polygonCoordinates",
      CASE WHEN s."geofenceType" = 'POLYGON' THEN 0 ELSE 2 * 6371000 * asin(sqrt(LEAST(1,
        POWER(sin(radians((s."latitude" - fl."latitude") / 2)), 2)
        + cos(radians(fl."latitude")) * cos(radians(s."latitude"))
        * POWER(sin(radians((s."longitude" - fl."longitude") / 2)), 2)
      ))) END AS "distanceMeters"
    FROM "School" AS s
    WHERE s."active" = true AND (s."geofenceType" = 'POLYGON' OR s."radiusMeters" > 0)
      ${schoolFilter}
      AND (
        (s."geofenceType" = 'CIRCLE' AND 2 * 6371000 * asin(sqrt(LEAST(1,
          POWER(sin(radians((s."latitude" - fl."latitude") / 2)), 2)
          + cos(radians(fl."latitude")) * cos(radians(s."latitude"))
          * POWER(sin(radians((s."longitude" - fl."longitude") / 2)), 2)
        ))) <= s."radiusMeters")
        OR (s."geofenceType" = 'POLYGON' AND ${polygonContainsLocation()})
      )
    ORDER BY "distanceMeters" ASC, s."id" ASC
    LIMIT 1
  ) AS matchedSchool ON true`;
}

export async function getAdminLocations(filters: AdminLocationFilters) {
  if (filters.deviceId) {
    const device = await prisma.device.findUnique({ where: { deviceId: filters.deviceId }, select: { deviceId: true } });
    if (!device) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device is not registered');
  }

  const base = locationBaseQuery(filters);
  const schoolJoin = schoolLateralJoin(filters.schoolId);
  const schoolCondition = filters.schoolId ? Prisma.sql`WHERE matchedSchool."id" IS NOT NULL` : Prisma.empty;
  const skip = (filters.page - 1) * filters.limit;
  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<AdminLocationRow[]>(Prisma.sql`
      ${base}
      SELECT fl."id", fl."trackerId", fl."latitude", fl."longitude", fl."accuracy",
        fl."recordedAt", fl."receivedAt", d."deviceId", d."platform", d."appVersion",
        d."lastSeenAt" AS "deviceLastSeenAt", matchedSchool."id" AS "schoolId",
        matchedSchool."name" AS "schoolName", matchedSchool."latitude" AS "schoolLatitude",
        matchedSchool."longitude" AS "schoolLongitude", matchedSchool."radiusMeters" AS "schoolRadiusMeters",
        matchedSchool."address" AS "schoolAddress", matchedSchool."geofenceType" AS "schoolGeofenceType",
        matchedSchool."polygonCoordinates" AS "schoolPolygonCoordinates"
      FROM "filteredLocations" AS fl
      INNER JOIN "Device" AS d ON d."deviceId" = fl."deviceId"
      ${schoolJoin}
      ${schoolCondition}
      ORDER BY fl."recordedAt" DESC, fl."receivedAt" DESC, fl."deviceId" ASC
      LIMIT ${filters.limit} OFFSET ${skip}
    `),
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      ${base}
      SELECT COUNT(*)::bigint AS total
      FROM "filteredLocations" AS fl
      INNER JOIN "Device" AS d ON d."deviceId" = fl."deviceId"
      ${schoolJoin}
      ${schoolCondition}
    `),
  ]);
  const total = Number(countRows[0]?.total ?? 0n);

  return {
    data: rows.map((row) => ({
      id: row.id,
      trackerId: row.trackerId,
      latitude: row.latitude,
      longitude: row.longitude,
      accuracy: row.accuracy,
      recordedAt: row.recordedAt,
      receivedAt: row.receivedAt,
      device: {
        deviceId: row.deviceId,
        platform: row.platform,
        appVersion: row.appVersion,
        lastSeenAt: row.deviceLastSeenAt,
      },
      school: row.schoolId
        ? {
            id: row.schoolId,
            name: row.schoolName,
            latitude: row.schoolLatitude,
            longitude: row.schoolLongitude,
            radiusMeters: row.schoolRadiusMeters,
            address: row.schoolAddress,
            geofence: row.schoolGeofenceType === 'POLYGON'
              ? { type: row.schoolGeofenceType, coordinates: row.schoolPolygonCoordinates }
              : { type: row.schoolGeofenceType, latitude: row.schoolLatitude, longitude: row.schoolLongitude, radiusMeters: row.schoolRadiusMeters },
          }
        : null,
    })),
    pagination: pageInfo(filters.page, filters.limit, total),
  };
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
    prisma.school.count({ where: { active: true } }),
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
