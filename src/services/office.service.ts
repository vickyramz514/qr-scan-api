import { prisma } from '../config/database';
import { AppError } from '../utils/errors';

export async function listOffices() {
  const offices = await prisma.school.findMany({
    where: { active: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, latitude: true, longitude: true, radiusMeters: true },
  });
  return { offices };
}

export async function getOffice(officeId?: string) {
  const office = officeId
    ? await prisma.school.findFirst({ where: { id: officeId, active: true } })
    : await prisma.school.findFirst({ where: { active: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  if (!office) {
    throw new AppError(404, officeId ? 'OFFICE_NOT_FOUND' : 'OFFICE_NOT_CONFIGURED', officeId ? 'The selected office is not available' : 'The office location is not configured');
  }

  return {
    office: {
      id: office.id,
      name: office.name,
      latitude: office.latitude,
      longitude: office.longitude,
      radiusMeters: office.radiusMeters,
    },
    presence: 'unknown',
  };
}
