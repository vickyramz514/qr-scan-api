import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/database';

const DEVICE_ID = '8f3a7c2e-91b4-4e2a-9f31';

function iso(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

describe('geofencing API', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.geofenceEvent.deleteMany();
    await prisma.locationSample.deleteMany();
    await prisma.deviceLocation.deleteMany();
    await prisma.deliveryStatusEvent.deleteMany();
    await prisma.deliverySchool.updateMany({ data: { status: 'PENDING', deviceId: null } });
    await prisma.school.updateMany({ data: { active: true } });
    await prisma.device.deleteMany({ where: { deviceId: DEVICE_ID } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('stores a location update without a bearer token', async () => {
    const response = await request(app).post('/api/locations').send({
      latitude: 13.0827,
      longitude: 80.2707,
      accuracy: 10,
      timestamp: iso(),
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.receivedAt).toEqual(expect.any(String));
    expect(response.body.data).toMatchObject({
      trackerId: 'unassigned',
      deviceId: null,
      latitude: 13.0827,
      longitude: 80.2707,
      accuracy: 10,
      stored: true,
    });
    expect(await prisma.locationSample.count()).toBe(1);
  });

  it('skips an insignificant location update', async () => {
    const firstAt = iso();
    await request(app).post('/api/locations').send({
      latitude: 13.0827,
      longitude: 80.2707,
      accuracy: 10,
      timestamp: firstAt,
    });

    const skipped = await request(app).post('/api/locations').send({
      latitude: 13.0827,
      longitude: 80.2708,
      accuracy: 12,
      timestamp: iso(5_000),
    });

    expect(skipped.status).toBe(200);
    expect(skipped.body.data.stored).toBe(false);
    expect(await prisma.locationSample.count()).toBe(1);

    const stored = await request(app).post('/api/locations').send({
      latitude: 13.09,
      longitude: 80.28,
      accuracy: 8,
      timestamp: iso(30_000),
    });

    expect(stored.body.data.stored).toBe(true);
    expect(await prisma.locationSample.count()).toBe(2);
  });

  it('rejects an invalid latitude', async () => {
    const response = await request(app).post('/api/locations').send({
      latitude: 95,
      longitude: 80.2707,
      accuracy: 10,
      timestamp: iso(),
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a location for an unknown device header', async () => {
    const response = await request(app)
      .post('/api/locations')
      .set('X-Device-Id', DEVICE_ID)
      .send({
        latitude: 13.0827,
        longitude: 80.2707,
        accuracy: 10,
        timestamp: iso(),
      });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('DEVICE_NOT_FOUND');
  });

  it('stores a geofence event and returns the same event for a duplicate id', async () => {
    const body = {
      eventId: 'school-001:ENTER:1690000000000:ab12cd34',
      schoolId: 'school-001',
      eventType: 'ENTER',
      latitude: 13.0827,
      longitude: 80.2707,
      accuracy: 10,
      eventTime: iso(-60_000),
    };

    const created = await request(app).post('/api/geofence-events').send(body);
    const duplicate = await request(app)
      .post('/api/geofence-events')
      .set('Idempotency-Key', body.eventId)
      .send(body);

    expect(created.status).toBe(201);
    expect(created.body.data.duplicate).toBe(false);
    expect(duplicate.status).toBe(200);
    expect(duplicate.body).toMatchObject({
      success: true,
      receivedAt: created.body.receivedAt,
      data: { eventId: body.eventId, duplicate: true },
    });
    expect(await prisma.geofenceEvent.count()).toBe(1);
    expect(await prisma.deliverySchool.findUnique({
      where: { deliveryId_schoolId: { deliveryId: 'route-001', schoolId: 'school-001' } },
    })).toMatchObject({ status: 'PENDING' });
  });

  it('stores geofence events that arrive out of time order', async () => {
    const exit = await request(app).post('/api/geofence-events').send({
      eventId: 'school-001:EXIT:2',
      schoolId: 'school-001',
      eventType: 'EXIT',
      latitude: 13.09,
      longitude: 80.28,
      accuracy: 15,
      eventTime: iso(-3_600_000),
    });
    const enter = await request(app).post('/api/geofence-events').send({
      eventId: 'school-001:ENTER:1',
      schoolId: 'school-001',
      eventType: 'ENTER',
      latitude: 13.0827,
      longitude: 80.2707,
      accuracy: 10,
      eventTime: iso(-7_200_000),
    });

    expect(exit.status).toBe(201);
    expect(enter.status).toBe(201);
    expect(await prisma.geofenceEvent.count()).toBe(2);
  });

  it('rejects an invalid geofence event type and an unknown school', async () => {
    const invalidType = await request(app).post('/api/geofence-events').send({
      eventId: 'school-001:ENTER:bad',
      schoolId: 'school-001',
      eventType: 'INSIDE',
      latitude: 13.0827,
      longitude: 80.2707,
      accuracy: 10,
      eventTime: iso(),
    });
    const unknownSchool = await request(app).post('/api/geofence-events').send({
      eventId: 'school-999:ENTER:1',
      schoolId: 'school-999',
      eventType: 'ENTER',
      latitude: 13.0827,
      longitude: 80.2707,
      accuracy: 10,
      eventTime: iso(),
    });

    expect(invalidType.status).toBe(400);
    expect(invalidType.body.error.code).toBe('VALIDATION_ERROR');
    expect(unknownSchool.status).toBe(404);
    expect(unknownSchool.body.error.code).toBe('SCHOOL_NOT_FOUND');
  });

  it('advances delivery status one step and rejects a skip', async () => {
    const moved = await request(app).post('/api/deliveries/route-001/status').send({
      schoolId: 'school-001',
      status: 'IN_TRANSIT',
    });
    const repeat = await request(app).post('/api/deliveries/route-001/status').send({
      schoolId: 'school-001',
      status: 'IN_TRANSIT',
    });
    const skipped = await request(app).post('/api/deliveries/route-001/status').send({
      schoolId: 'school-001',
      status: 'DELIVERED',
    });
    const mismatch = await request(app).post('/api/deliveries/route-001/status').send({
      schoolId: 'school-999',
      status: 'ARRIVED',
    });

    expect(moved.status).toBe(200);
    expect(moved.body.receivedAt).toEqual(expect.any(String));
    expect(moved.body.data.status).toBe('IN_TRANSIT');
    expect(repeat.status).toBe(200);
    expect(await prisma.deliveryStatusEvent.count()).toBe(1);
    expect(skipped.status).toBe(400);
    expect(skipped.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    expect(mismatch.status).toBe(404);
    expect(mismatch.body.error.code).toBe('DELIVERY_SCHOOL_MISMATCH');
  });

  it('returns a database error when school lookup fails', async () => {
    const spy = jest.spyOn(prisma.school, 'findUnique').mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('database unavailable', {
        code: 'P1001',
        clientVersion: 'test',
      }),
    );

    const response = await request(app).post('/api/geofence-events').send({
      eventId: 'school-001:ENTER:db-failure',
      schoolId: 'school-001',
      eventType: 'ENTER',
      latitude: 13.0827,
      longitude: 80.2707,
      accuracy: 10,
      eventTime: iso(),
    });

    spy.mockRestore();
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'A database error occurred',
      },
    });
  });
});
