import { School } from '@prisma/client';
import { prisma } from '../config/database';

export async function findSchoolById(id: string): Promise<School | null> {
  return prisma.school.findUnique({ where: { id } });
}
