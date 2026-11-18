import { Request, Response } from 'express';
import * as adminService from '../services/admin.service';
import {
  adminDashboardQuerySchema,
  adminDataQuerySchema,
  adminDeviceLocationQuerySchema,
  adminLocationListQuerySchema,
} from '../validators/admin.validator';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/errors';
import { deviceIdSchema } from '../validators/device.validator';
import * as schoolAdminService from '../services/school-admin.service';
import { createSchoolSchema, listSchoolsQuerySchema, schoolIdSchema, updateSchoolSchema } from '../validators/school.validator';
import * as geofenceEventAdminService from '../services/geofence-event-admin.service';
import {
  geofenceEventExportQuerySchema,
  geofenceEventIdSchema,
  geofenceEventListQuerySchema,
} from '../validators/geofence-event-admin.validator';
import * as deviceAdminService from '../services/device-admin.service';
import {
  createDeviceAdminSchema,
  listDevicesQuerySchema,
  updateDeviceAdminSchema,
  updateDeviceStatusSchema,
} from '../validators/device-admin.validator';

export async function getAdminData(req: Request, res: Response): Promise<void> {
  const query = adminDataQuerySchema.parse(req.query);
  sendSuccess(res, await adminService.getAdminData(query));
}

export async function getAdminDashboard(req: Request, res: Response): Promise<void> {
  const query = adminDashboardQuerySchema.parse(req.query);
  sendSuccess(res, await adminService.getAdminDashboard(query));
}

export async function getAdminLatestLocations(req: Request, res: Response): Promise<void> {
  const query = adminLocationListQuerySchema.parse(req.query);
  sendSuccess(res, await adminService.getAdminLocations({ ...query, latestPerDevice: true }));
}

export async function getAdminLocationHistory(req: Request, res: Response): Promise<void> {
  const query = adminLocationListQuerySchema.parse(req.query);
  sendSuccess(res, await adminService.getAdminLocations({ ...query, latestPerDevice: false }));
}

export async function getAdminDeviceLocations(req: Request, res: Response): Promise<void> {
  const parsedId = deviceIdSchema.safeParse(req.params.deviceId);
  if (!parsedId.success) {
    throw new AppError(400, 'INVALID_DEVICE_ID', 'Invalid device id');
  }
  const query = adminDeviceLocationQuerySchema.parse(req.query);
  sendSuccess(
    res,
    await adminService.getAdminLocations({ ...query, deviceId: parsedId.data, latestPerDevice: false }),
  );
}

function parseSchoolId(value: string | string[] | undefined): string {
  const id = Array.isArray(value) ? value[0] : value;
  const parsed = schoolIdSchema.safeParse(id);
  if (!parsed.success) throw new AppError(400, 'INVALID_SCHOOL_ID', 'Invalid school id');
  return parsed.data;
}

export async function listAdminSchools(req: Request, res: Response): Promise<void> {
  const query = listSchoolsQuerySchema.parse(req.query);
  const result = await schoolAdminService.listSchools(query);
  res.status(200).json({ success: true, ...result });
}

export async function getAdminSchool(req: Request, res: Response): Promise<void> {
  sendSuccess(res, await schoolAdminService.getSchool(parseSchoolId(req.params.id)));
}

export async function createAdminSchool(req: Request, res: Response): Promise<void> {
  const input = createSchoolSchema.parse(req.body);
  sendSuccess(res, await schoolAdminService.createSchool(input), 201);
}

export async function updateAdminSchool(req: Request, res: Response): Promise<void> {
  const id = parseSchoolId(req.params.id);
  const input = updateSchoolSchema.parse(req.body);
  sendSuccess(res, await schoolAdminService.updateSchool(id, input));
}

export async function deleteAdminSchool(req: Request, res: Response): Promise<void> {
  sendSuccess(res, await schoolAdminService.disableSchool(parseSchoolId(req.params.id)));
}

export async function deleteAdminOffice(req: Request, res: Response): Promise<void> {
  sendSuccess(res, await schoolAdminService.deleteOffice(parseSchoolId(req.params.id)));
}

export async function listAdminGeofenceEvents(req: Request, res: Response): Promise<void> {
  const query = geofenceEventListQuerySchema.parse(req.query);
  const result = await geofenceEventAdminService.listGeofenceEvents(query);
  res.status(200).json({ success: true, ...result });
}

export async function getAdminGeofenceEvent(req: Request, res: Response): Promise<void> {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsedId = geofenceEventIdSchema.safeParse(rawId);
  if (!parsedId.success) throw new AppError(400, 'INVALID_GEOFENCE_EVENT_ID', 'Invalid geofence event id');
  sendSuccess(res, await geofenceEventAdminService.getGeofenceEvent(parsedId.data));
}

export async function exportAdminGeofenceEvents(req: Request, res: Response): Promise<void> {
  const query = geofenceEventExportQuerySchema.parse(req.query);
  const result = await geofenceEventAdminService.exportGeofenceEvents(query);
  const filename = `geofence-events-${new Date().toISOString().slice(0, 10)}.csv`;
  res
    .status(200)
    .type('text/csv')
    .set('Content-Disposition', `attachment; filename="${filename}"`)
    .set('X-Total-Count', String(result.total))
    .set('X-Export-Truncated', String(result.truncated))
    .send(geofenceEventAdminService.geofenceEventsToCsv(result.events));
}

export async function listAdminDevices(req: Request, res: Response): Promise<void> {
  const query = listDevicesQuerySchema.parse(req.query);
  const result = await deviceAdminService.listDevices(query);
  res.status(200).json({ success: true, ...result });
}

export async function getAdminDevice(req: Request, res: Response): Promise<void> {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsedId = deviceIdSchema.safeParse(rawId);
  if (!parsedId.success) throw new AppError(400, 'INVALID_DEVICE_ID', 'Invalid device id');
  sendSuccess(res, await deviceAdminService.getDevice(parsedId.data));
}

export async function createAdminDevice(req: Request, res: Response): Promise<void> {
  const input = createDeviceAdminSchema.parse(req.body);
  sendSuccess(res, await deviceAdminService.createDevice(input), 201);
}

export async function updateAdminDevice(req: Request, res: Response): Promise<void> {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsedId = deviceIdSchema.safeParse(rawId);
  if (!parsedId.success) throw new AppError(400, 'INVALID_DEVICE_ID', 'Invalid device id');
  const input = updateDeviceAdminSchema.parse(req.body);
  sendSuccess(res, await deviceAdminService.updateDevice(parsedId.data, input));
}

export async function updateAdminDeviceStatus(req: Request, res: Response): Promise<void> {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsedId = deviceIdSchema.safeParse(rawId);
  if (!parsedId.success) throw new AppError(400, 'INVALID_DEVICE_ID', 'Invalid device id');
  const input = updateDeviceStatusSchema.parse(req.body);
  sendSuccess(res, await deviceAdminService.updateDeviceStatus(parsedId.data, input.active));
}

export async function deleteAdminDevice(req: Request, res: Response): Promise<void> {
  const parsedId = deviceIdSchema.safeParse(req.params.id);
  if (!parsedId.success) throw new AppError(400, 'INVALID_DEVICE_ID', 'Invalid device id');
  sendSuccess(res, await deviceAdminService.deleteDevice(parsedId.data));
}
