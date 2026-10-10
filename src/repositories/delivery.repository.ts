import { DeliverySchool, DeliveryStatus } from '@prisma/client';
import { prisma } from '../config/database';

export type DeliveryLookup =
  | { kind: 'missing-delivery' }
  | { kind: 'school-mismatch' }
  | { kind: 'found'; row: DeliverySchool; schoolActive: boolean };

export async function lookupDeliverySchool(deliveryId: string, schoolId: string): Promise<DeliveryLookup> {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    select: { id: true },
  });

  if (!delivery) {
    return { kind: 'missing-delivery' };
  }

  const link = await prisma.deliverySchool.findUnique({
    where: { deliveryId_schoolId: { deliveryId, schoolId } },
    include: { school: { select: { active: true } } },
  });

  if (!link) {
    return { kind: 'school-mismatch' };
  }

  return { kind: 'found', row: link, schoolActive: link.school.active };
}

export async function applyStatusChange(input: {
  deliveryId: string;
  schoolId: string;
  fromStatus: DeliveryStatus;
  toStatus: DeliveryStatus;
  deviceId: string | null;
}): Promise<DeliverySchool | null> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.deliverySchool.findUnique({
      where: { deliveryId_schoolId: { deliveryId: input.deliveryId, schoolId: input.schoolId } },
    });

    if (!current || current.status !== input.fromStatus) {
      return null;
    }

    const updated = await tx.deliverySchool.update({
      where: { deliveryId_schoolId: { deliveryId: input.deliveryId, schoolId: input.schoolId } },
      data: {
        status: input.toStatus,
        ...(input.deviceId ? { deviceId: input.deviceId } : {}),
      },
    });

    await tx.deliveryStatusEvent.create({
      data: {
        deliveryId: input.deliveryId,
        schoolId: input.schoolId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
      },
    });

    return updated;
  });
}

export async function countStatusEvents(deliveryId: string, schoolId: string): Promise<number> {
  return prisma.deliveryStatusEvent.count({ where: { deliveryId, schoolId } });
}
