import { GeofenceShape, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { distanceMeters } from '../utils/geo';
import { AppError } from '../utils/errors';
import { CreateDeviceAdminInput, ListDevicesQuery, UpdateDeviceAdminInput } from '../validators/device-admin.validator';

const deviceInclude = {
  currentLocation: true,
  schoolAssignments: {
    orderBy: { assignedAt: 'asc' as const },
    include: {
      school: {
        select: {
          id: true,
          name: true,
          active: true,
          latitude: true,
          longitude: true,
          radiusMeters: true,
          geofenceType: true,
          polygonCoordinates: true,
          address: true,
        },
      },
    },
  },
};

function readPolygon(value: Prisma.JsonValue | null): Array<{ latitude: number; longitude: number }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((point) => {
    if (point === null || Array.isArray(point) || typeof point !== 'object') return [];
    const latitude = point.latitude;
    const longitude = point.longitude;
    return typeof latitude === 'number' && typeof longitude === 'number' ? [{ latitude, longitude }] : [];
  });
}

function pointInPolygon(point: { latitude: number; longitude: number }, polygon: Array<{ latitude: number; longitude: number }>): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    if (!currentPoint || !previousPoint) continue;
    const crosses = (currentPoint.latitude > point.latitude) !== (previousPoint.latitude > point.latitude)
      && point.longitude < ((previousPoint.longitude - currentPoint.longitude)
        * (point.latitude - currentPoint.latitude))
        / (previousPoint.latitude - currentPoint.latitude)
        + currentPoint.longitude;
    if (crosses) inside = !inside;
  }
  return inside;
}

function isInsideSchool(point: { latitude: number; longitude: number }, school: {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  geofenceType: GeofenceShape;
  polygonCoordinates: Prisma.JsonValue | null;
}): boolean {
  if (school.geofenceType === GeofenceShape.POLYGON) return pointInPolygon(point, readPolygon(school.polygonCoordinates));
  return distanceMeters(point, school) <= school.radiusMeters;
}

function presentDevice(device: Prisma.DeviceGetPayload<{ include: typeof deviceInclude }>) {
  const location = device.currentLocation;
  const assignments = device.schoolAssignments.map(({ school, assignedAt }) => ({
    assignedAt,
    school: {
      id: school.id,
      name: school.name,
      active: school.active,
      address: school.address,
      geofence: school.geofenceType === GeofenceShape.POLYGON
        ? { type: school.geofenceType, coordinates: school.polygonCoordinates }
        : {
            type: school.geofenceType,
            latitude: school.latitude,
            longitude: school.longitude,
            radiusMeters: school.radiusMeters,
          },
    },
  }));
  const activeAssignedSchools = device.schoolAssignments.map(({ school }) => school).filter((school) => school.active);
  const matchingSchool = location
    ? activeAssignedSchools.find((school) => isInsideSchool(location, school))
    : undefined;

  return {
    deviceId: device.deviceId,
    platform: device.platform,
    appVersion: device.appVersion,
    status: device.active ? 'ACTIVE' : 'INACTIVE',
    active: device.active,
    createdAt: device.createdAt,
    lastSeenAt: device.lastSeenAt,
    latestGpsLocation: location
      ? {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          recordedAt: location.recordedAt,
          receivedAt: location.receivedAt,
        }
      : null,
    geofencePresence: {
      status: !location || activeAssignedSchools.length === 0 ? 'UNKNOWN' : matchingSchool ? 'INSIDE' : 'OUTSIDE',
      school: matchingSchool ? { id: matchingSchool.id, name: matchingSchool.name } : null,
    },
    schools: assignments,
  };
}

async function requireActiveSchools(tx: Prisma.TransactionClient, schoolIds: string[]): Promise<void> {
  if (schoolIds.length === 0) return;
  const found = await tx.school.findMany({
    where: { id: { in: schoolIds }, active: true },
    select: { id: true },
  });
  const known = new Set(found.map(({ id }) => id));
  const missing = schoolIds.filter((id) => !known.has(id));
  if (missing.length > 0) {
    throw new AppError(400, 'INVALID_SCHOOL_IDS', 'One or more schools do not exist or are inactive', { schoolIds: missing });
  }
}

export async function listDevices(query: ListDevicesQuery) {
  const where: Prisma.DeviceWhereInput = {
    ...(query.active === undefined ? {} : { active: query.active }),
    ...(query.schoolId ? { schoolAssignments: { some: { schoolId: query.schoolId } } } : {}),
    ...(query.search ? { deviceId: { contains: query.search, mode: 'insensitive' } } : {}),
  };
  const [devices, total] = await Promise.all([
    prisma.device.findMany({
      where,
      include: deviceInclude,
      orderBy: [{ lastSeenAt: 'desc' }, { deviceId: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.device.count({ where }),
  ]);
  return {
    data: devices.map(presentDevice),
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function getDevice(deviceId: string) {
  const device = await prisma.device.findUnique({ where: { deviceId }, include: deviceInclude });
  if (!device) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device not found');
  return presentDevice(device);
}

export async function createDevice(input: CreateDeviceAdminInput) {
  try {
    await prisma.$transaction(async (tx) => {
      await requireActiveSchools(tx, input.schoolIds);
      await tx.device.create({
        data: { deviceId: input.deviceId, platform: input.platform, appVersion: input.appVersion ?? null },
      });
      if (input.schoolIds.length > 0) {
        await tx.schoolDevice.createMany({ data: input.schoolIds.map((schoolId) => ({ schoolId, deviceId: input.deviceId })) });
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'DEVICE_ALREADY_EXISTS', 'A device with this id already exists');
    }
    throw error;
  }
  return getDevice(input.deviceId);
}

export async function updateDevice(deviceId: string, input: UpdateDeviceAdminInput) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.device.findUnique({ where: { deviceId }, select: { deviceId: true } });
    if (!existing) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device not found');
    if (input.schoolIds !== undefined) {
      await requireActiveSchools(tx, input.schoolIds);
      await tx.schoolDevice.deleteMany({ where: { deviceId } });
      if (input.schoolIds.length > 0) {
        await tx.schoolDevice.createMany({ data: input.schoolIds.map((schoolId) => ({ schoolId, deviceId })) });
      }
    }
    await tx.device.update({
      where: { deviceId },
      data: {
        ...(input.platform !== undefined ? { platform: input.platform } : {}),
        ...(input.appVersion !== undefined ? { appVersion: input.appVersion } : {}),
      },
    });
  });
  return getDevice(deviceId);
}

export async function updateDeviceStatus(deviceId: string, active: boolean) {
  const exists = await prisma.device.findUnique({ where: { deviceId }, select: { deviceId: true } });
  if (!exists) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device not found');
  await prisma.device.update({ where: { deviceId }, data: { active } });
  return getDevice(deviceId);
}
