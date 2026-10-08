import { Prisma, Scan, ScanStatus, ScanType } from '@prisma/client';
import { Pagination } from '../utils/apiResponse';
import { AppError } from '../utils/errors';
import * as deviceRepository from '../repositories/device.repository';
import * as scanRepository from '../repositories/scan.repository';
import { CreateScanInput, ListScansQuery } from '../validators/scan.validator';

export type ScanResponse = {
  id: string;
  deviceId: string;
  code: string;
  type: ScanType;
  status: ScanStatus;
  createdAt: string;
};

function toScanResponse(scan: Scan): ScanResponse {
  return {
    id: scan.id,
    deviceId: scan.deviceId,
    code: scan.code,
    type: scan.type,
    status: scan.status,
    createdAt: scan.createdAt.toISOString(),
  };
}

function toPage(items: Scan[], total: number, query: ListScansQuery): {
  data: ScanResponse[];
  pagination: Pagination;
} {
  return {
    data: items.map(toScanResponse),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

function duplicateScanError(): AppError {
  return new AppError(400, 'VALIDATION_ERROR', 'This code already exists', [
    { path: 'code', message: 'This code already exists' },
  ]);
}

export async function createScan(input: CreateScanInput): Promise<ScanResponse> {
  const device = await deviceRepository.findDeviceById(input.deviceId);

  if (!device) {
    throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device is not registered');
  }

  const existing = await scanRepository.findScanByCode(input.code);
  if (existing) {
    throw duplicateScanError();
  }

  try {
    const scan = await scanRepository.createScan({
      deviceId: input.deviceId,
      code: input.code,
      type: input.type,
    });

    return toScanResponse(scan);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw duplicateScanError();
    }

    throw error;
  }
}

export async function clearScans(): Promise<{ deleted: number }> {
  const deleted = await scanRepository.deleteAllScans();
  return { deleted };
}

export async function listScans(query: ListScansQuery): Promise<{
  data: ScanResponse[];
  pagination: Pagination;
}> {
  const { items, total } = await scanRepository.listScans(query);
  return toPage(items, total, query);
}

export async function listDeviceScans(
  deviceId: string,
  query: ListScansQuery,
): Promise<{ data: ScanResponse[]; pagination: Pagination }> {
  const device = await deviceRepository.findDeviceById(deviceId);

  if (!device) {
    throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device is not registered');
  }

  const { items, total } = await scanRepository.listScansByDevice(deviceId, query);
  return toPage(items, total, query);
}

export async function getScan(id: string): Promise<ScanResponse> {
  const scan = await scanRepository.findScanById(id);

  if (!scan) {
    throw new AppError(404, 'SCAN_NOT_FOUND', 'Scan not found');
  }

  return toScanResponse(scan);
}
