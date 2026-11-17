import { prisma } from '../config/database';
import { AdminDataQuery } from '../validators/admin.validator';

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
