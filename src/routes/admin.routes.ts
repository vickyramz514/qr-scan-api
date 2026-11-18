import { Router } from 'express';
import {
  getAdminDashboard,
  getAdminData,
  getAdminDeviceLocations,
  getAdminLatestLocations,
  getAdminLocationHistory,
  listAdminSchools,
  getAdminSchool,
  createAdminSchool,
  updateAdminSchool,
  deleteAdminSchool,
  deleteAdminOffice,
  listAdminGeofenceEvents,
  getAdminGeofenceEvent,
  exportAdminGeofenceEvents,
  listAdminDevices,
  getAdminDevice,
  createAdminDevice,
  updateAdminDevice,
  updateAdminDeviceStatus,
  deleteAdminDevice,
} from '../controllers/admin.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAdmin } from '../middleware/admin-auth.middleware';

export const adminRouter = Router();

adminRouter.use(requireAdmin);

adminRouter.get('/data', asyncHandler(getAdminData));
adminRouter.get('/dashboard', asyncHandler(getAdminDashboard));
adminRouter.get('/locations/latest', asyncHandler(getAdminLatestLocations));
adminRouter.get('/locations/history', asyncHandler(getAdminLocationHistory));
adminRouter.get('/locations/:deviceId', asyncHandler(getAdminDeviceLocations));
adminRouter.get('/schools', asyncHandler(listAdminSchools));
adminRouter.get('/schools/:id', asyncHandler(getAdminSchool));
adminRouter.post('/schools', asyncHandler(createAdminSchool));
adminRouter.put('/schools/:id', asyncHandler(updateAdminSchool));
adminRouter.delete('/schools/:id', asyncHandler(deleteAdminSchool));
adminRouter.delete('/offices/:id', asyncHandler(deleteAdminOffice));
adminRouter.get('/geofence-events', asyncHandler(listAdminGeofenceEvents));
adminRouter.get('/geofence-events/export', asyncHandler(exportAdminGeofenceEvents));
adminRouter.get('/geofence-events/:id', asyncHandler(getAdminGeofenceEvent));
adminRouter.get('/devices', asyncHandler(listAdminDevices));
adminRouter.post('/devices', asyncHandler(createAdminDevice));
adminRouter.get('/devices/:id', asyncHandler(getAdminDevice));
adminRouter.put('/devices/:id', asyncHandler(updateAdminDevice));
adminRouter.patch('/devices/:id/status', asyncHandler(updateAdminDeviceStatus));
adminRouter.delete('/devices/:id', asyncHandler(deleteAdminDevice));
