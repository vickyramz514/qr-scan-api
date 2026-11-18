import { GeofenceShape, Prisma, School } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/errors';
import { CreateSchoolInput, GeofenceInput, ListSchoolsQuery, UpdateSchoolInput } from '../validators/school.validator';

function shapeData(geofence: GeofenceInput) {
  if (geofence.type === 'CIRCLE') {
    return {
      latitude: geofence.latitude,
      longitude: geofence.longitude,
      radiusMeters: geofence.radiusMeters,
      geofenceType: GeofenceShape.CIRCLE,
      polygonCoordinates: Prisma.DbNull,
    };
  }

  const latitude = geofence.coordinates.reduce((total, point) => total + point.latitude, 0) / geofence.coordinates.length;
  const longitude = geofence.coordinates.reduce((total, point) => total + point.longitude, 0) / geofence.coordinates.length;
  return {
    latitude,
    longitude,
    radiusMeters: 0,
    geofenceType: GeofenceShape.POLYGON,
    polygonCoordinates: geofence.coordinates as Prisma.InputJsonValue,
  };
}

function toGeofence(school: School) {
  if (school.geofenceType === GeofenceShape.POLYGON) {
    return { type: school.geofenceType, coordinates: school.polygonCoordinates };
  }
  return {
    type: school.geofenceType,
    latitude: school.latitude,
    longitude: school.longitude,
    radiusMeters: school.radiusMeters,
  };
}

const schoolInclude = {
  deviceAssignments: {
    orderBy: { assignedAt: 'asc' as const },
    include: { device: { select: { deviceId: true, platform: true, appVersion: true, lastSeenAt: true } } },
  },
};

function presentSchool<T extends School & { deviceAssignments: Array<{ device: unknown }> }>(school: T) {
  return {
    id: school.id,
    name: school.name,
    address: school.address,
    active: school.active,
    geofence: toGeofence(school),
    devices: school.deviceAssignments.map(({ device }) => device),
    createdAt: school.createdAt,
    updatedAt: school.updatedAt,
  };
}

export async function listSchools(query: ListSchoolsQuery) {
  const where: Prisma.SchoolWhereInput = {
    ...(query.active === undefined ? {} : { active: query.active }),
    ...(query.search ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { id: { contains: query.search, mode: 'insensitive' } }] } : {}),
  };
  const skip = (query.page - 1) * query.limit;
  const [schools, total] = await Promise.all([
    prisma.school.findMany({ where, include: schoolInclude, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip, take: query.limit }),
    prisma.school.count({ where }),
  ]);
  return {
    data: schools.map(presentSchool),
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function getSchool(id: string) {
  const school = await prisma.school.findUnique({ where: { id }, include: schoolInclude });
  if (!school) throw new AppError(404, 'SCHOOL_NOT_FOUND', 'School not found');
  return presentSchool(school);
}

async function requireDevicesExist(tx: Prisma.TransactionClient, deviceIds: string[]): Promise<void> {
  if (deviceIds.length === 0) return;
  const found = await tx.device.findMany({ where: { deviceId: { in: deviceIds } }, select: { deviceId: true } });
  const known = new Set(found.map((device) => device.deviceId));
  const missing = deviceIds.filter((deviceId) => !known.has(deviceId));
  if (missing.length > 0) {
    throw new AppError(400, 'UNKNOWN_DEVICE_IDS', 'One or more devices are not registered', { deviceIds: missing });
  }
}

export async function createSchool(input: CreateSchoolInput) {
  try {
    const school = await prisma.$transaction(async (tx) => {
      await requireDevicesExist(tx, input.deviceIds);
      return tx.school.create({
        data: {
          id: input.id,
          name: input.name,
          address: input.address ?? null,
          active: input.active,
          ...shapeData(input.geofence),
          deviceAssignments: { create: input.deviceIds.map((deviceId) => ({ deviceId })) },
        },
        include: schoolInclude,
      });
    });
    return presentSchool(school);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'SCHOOL_ALREADY_EXISTS', 'A school with this id already exists');
    }
    throw error;
  }
}

export async function updateSchool(id: string, input: UpdateSchoolInput) {
  const school = await prisma.$transaction(async (tx) => {
    const existing = await tx.school.findUnique({ where: { id }, include: schoolInclude });
    if (!existing) throw new AppError(404, 'SCHOOL_NOT_FOUND', 'School not found');
    if (input.deviceIds !== undefined) await requireDevicesExist(tx, input.deviceIds);

    const assignmentChanges = input.deviceIds === undefined
      ? undefined
      : {
          deleteMany: {},
          create: input.deviceIds.map((deviceId) => ({ deviceId })),
        };
    const updated = await tx.school.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.geofence !== undefined ? shapeData(input.geofence) : {}),
        ...(assignmentChanges ? { deviceAssignments: assignmentChanges } : {}),
      },
      include: schoolInclude,
    });
    return presentSchool(updated);
  });
  return school;
}

export async function disableSchool(id: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.school.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new AppError(404, 'SCHOOL_NOT_FOUND', 'School not found');
    const updated = await tx.school.update({ where: { id }, data: { active: false } });
    await tx.schoolDevice.deleteMany({ where: { schoolId: id } });
    return { id: updated.id, name: updated.name, active: updated.active, deleted: true };
  });
}

export async function deleteOffice(id: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.school.findUnique({
      where: { id },
      include: { _count: { select: { events: true, deliveries: true } } },
    });
    if (!existing) throw new AppError(404, 'OFFICE_NOT_FOUND', 'Office not found');
    if (existing._count.events > 0 || existing._count.deliveries > 0) {
      throw new AppError(409, 'OFFICE_IN_USE', 'Office has event or delivery history and cannot be deleted. Disable it instead.');
    }

    await tx.schoolDevice.deleteMany({ where: { schoolId: id } });
    await tx.school.delete({ where: { id } });
    return { id, name: existing.name, deleted: true };
  });
}
