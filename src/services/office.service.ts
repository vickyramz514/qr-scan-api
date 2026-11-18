import { prisma } from '../config/database';
import { AppError } from '../utils/errors';

export async function getOffice() {
  const office = await prisma.school.findFirst({ where: { active: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  if (!office) {
    throw new AppError(404, 'OFFICE_NOT_CONFIGURED', 'The office location is not configured');
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
