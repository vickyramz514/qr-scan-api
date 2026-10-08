import { Scan, ScanType } from '@prisma/client';
import { prisma } from '../config/database';

export type CreateScanRecord = {
  deviceId: string;
  code: string;
  type: ScanType;
};

export type ListScansParams = {
  page: number;
  limit: number;
};

export async function createScan(input: CreateScanRecord): Promise<Scan> {
  return prisma.$transaction(async (tx) => {
    await tx.device.update({
      where: { deviceId: input.deviceId },
      data: { lastSeenAt: new Date() },
    });

    return tx.scan.create({
      data: {
        deviceId: input.deviceId,
        code: input.code,
        type: input.type,
        status: 'RECEIVED',
      },
    });
  });
}

export async function listScans(params: ListScansParams): Promise<{ items: Scan[]; total: number }> {
  const [items, total] = await prisma.$transaction([
    prisma.scan.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
    prisma.scan.count(),
  ]);

  return { items, total };
}

export async function listScansByDevice(
  deviceId: string,
  params: ListScansParams,
): Promise<{ items: Scan[]; total: number }> {
  const where = { deviceId };

  const [items, total] = await prisma.$transaction([
    prisma.scan.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
    prisma.scan.count({ where }),
  ]);

  return { items, total };
}

export async function findScanById(id: string): Promise<Scan | null> {
  return prisma.scan.findUnique({
    where: { id },
  });
}
