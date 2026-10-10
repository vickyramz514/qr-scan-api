import { DeliveryStatus } from '@prisma/client';
import * as deliveryRepository from '../repositories/delivery.repository';
import { Tracker } from '../utils/actor';
import { AppError } from '../utils/errors';
import { DeliveryStatusInput } from '../validators/geofence.validator';

const STATUS_ORDER: DeliveryStatus[] = [
  'PENDING',
  'IN_TRANSIT',
  'ARRIVED',
  'DELIVERED',
  'FITTING_IN_PROGRESS',
  'COMPLETED',
];

export type DeliveryStatusResult = {
  deliveryId: string;
  schoolId: string;
  status: DeliveryStatus;
  deviceId: string | null;
  updatedAt: string;
  receivedAt: string;
};

function canTransition(from: DeliveryStatus, to: DeliveryStatus): boolean {
  return STATUS_ORDER.indexOf(to) === STATUS_ORDER.indexOf(from) + 1;
}

export async function updateDeliveryStatus(
  deliveryId: string,
  tracker: Tracker,
  input: DeliveryStatusInput,
): Promise<DeliveryStatusResult> {
  const lookup = await deliveryRepository.lookupDeliverySchool(deliveryId, input.schoolId);

  if (lookup.kind === 'missing-delivery') {
    throw new AppError(404, 'DELIVERY_NOT_FOUND', 'Delivery not found');
  }

  if (lookup.kind === 'school-mismatch') {
    throw new AppError(404, 'DELIVERY_SCHOOL_MISMATCH', 'Delivery is not assigned to this school');
  }

  if (!lookup.schoolActive) {
    throw new AppError(409, 'SCHOOL_INACTIVE', 'School geofence is inactive');
  }

  const receivedAt = new Date().toISOString();

  if (lookup.row.status === input.status) {
    return {
      deliveryId,
      schoolId: input.schoolId,
      status: lookup.row.status,
      deviceId: lookup.row.deviceId,
      updatedAt: lookup.row.updatedAt.toISOString(),
      receivedAt,
    };
  }

  if (!canTransition(lookup.row.status, input.status)) {
    throw new AppError(400, 'INVALID_STATUS_TRANSITION', 'Delivery status cannot move to that step');
  }

  const updated = await deliveryRepository.applyStatusChange({
    deliveryId,
    schoolId: input.schoolId,
    fromStatus: lookup.row.status,
    toStatus: input.status,
    deviceId: tracker.deviceId,
  });

  if (!updated) {
    throw new AppError(409, 'STATUS_CONFLICT', 'Delivery status changed while this update was in progress');
  }

  return {
    deliveryId,
    schoolId: input.schoolId,
    status: updated.status,
    deviceId: updated.deviceId,
    updatedAt: updated.updatedAt.toISOString(),
    receivedAt,
  };
}
