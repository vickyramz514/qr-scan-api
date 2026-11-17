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
  listAdminGeofenceEvents,
  getAdminGeofenceEvent,
  exportAdminGeofenceEvents,
} from '../controllers/admin.controller';
import { asyncHandler } from '../utils/asyncHandler';

export const adminRouter = Router();

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
adminRouter.get('/geofence-events', asyncHandler(listAdminGeofenceEvents));
adminRouter.get('/geofence-events/export', asyncHandler(exportAdminGeofenceEvents));
adminRouter.get('/geofence-events/:id', asyncHandler(getAdminGeofenceEvent));
