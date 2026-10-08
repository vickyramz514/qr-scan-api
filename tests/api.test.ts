import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/database';

const DEVICE_A = '8f3a7c2e-91b4-4e2a-9f31';
const DEVICE_B = '11111111-2222-4333-8444-555555555555';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function registerDevice(
  deviceId = DEVICE_A,
  body: Record<string, unknown> = {},
) {
  return request(app)
    .post('/api/v1/devices')
    .send({
      deviceId,
      platform: 'android',
      appVersion: '1.0.0',
      ...body,
    });
}

async function submitScan(
  deviceId: string,
  code: string,
  type: 'QR' | 'BARCODE',
) {
  return request(app).post('/api/v1/scans').send({ deviceId, code, type });
}

describe('QR scan API', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.scan.deleteMany();
    await prisma.device.deleteMany();
  });

  afterAll(async () => {
    await prisma.scan.deleteMany();
    await prisma.device.deleteMany();
    await prisma.$disconnect();
  });

  it('registers a new device', async () => {
    const response = await registerDevice();

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      deviceId: DEVICE_A,
      platform: 'android',
      appVersion: '1.0.0',
    });
    expect(response.body.data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(response.body.data.lastSeenAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Object.keys(response.body.data).sort()).toEqual([
      'appVersion',
      'createdAt',
      'deviceId',
      'lastSeenAt',
      'platform',
    ]);
    expect(await prisma.device.count()).toBe(1);
  });

  it('updates an existing device without creating a duplicate', async () => {
    const first = await registerDevice();
    await delay(30);

    const second = await registerDevice(DEVICE_A, {
      platform: 'ios',
      appVersion: '1.1.0',
    });

    expect(second.status).toBe(200);
    expect(second.body.data.deviceId).toBe(DEVICE_A);
    expect(second.body.data.platform).toBe('ios');
    expect(second.body.data.appVersion).toBe('1.1.0');
    expect(second.body.data.createdAt).toBe(first.body.data.createdAt);
    expect(new Date(second.body.data.lastSeenAt).getTime()).toBeGreaterThan(
      new Date(first.body.data.lastSeenAt).getTime(),
    );
    expect(await prisma.device.count()).toBe(1);

    const third = await registerDevice(DEVICE_A, { appVersion: undefined, platform: 'ios' });
    expect(third.body.data.appVersion).toBe('1.1.0');
    expect(await prisma.device.count()).toBe(1);
  });

  it('rejects an invalid device request', async () => {
    const missingId = await request(app).post('/api/v1/devices').send({
      platform: 'android',
    });

    expect(missingId.status).toBe(400);
    expect(missingId.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
      },
    });
    expect(missingId.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'deviceId' })]),
    );

    const invalidId = await request(app).post('/api/v1/devices').send({
      deviceId: 'bad id',
      platform: 'android',
    });

    expect(invalidId.status).toBe(400);
    expect(invalidId.body.error.code).toBe('VALIDATION_ERROR');

    const invalidPlatform = await request(app).post('/api/v1/devices').send({
      deviceId: DEVICE_A,
      platform: 'windows',
    });

    expect(invalidPlatform.status).toBe(400);
    expect(invalidPlatform.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'platform', message: 'Platform must be android or ios' }),
      ]),
    );
    expect(await prisma.device.count()).toBe(0);
  });

  it('creates a QR scan and rejects a code that is already stored', async () => {
    await registerDevice();
    await registerDevice(DEVICE_B, { platform: 'ios' });
    const before = await prisma.device.findUniqueOrThrow({ where: { deviceId: DEVICE_A } });
    await delay(30);

    const first = await submitScan(DEVICE_A, '  ABC123456  ', 'QR');
    const duplicate = await submitScan(DEVICE_B, 'ABC123456', 'BARCODE');

    expect(first.status).toBe(201);
    expect(first.body.success).toBe(true);
    expect(first.body.data).toMatchObject({
      deviceId: DEVICE_A,
      code: 'ABC123456',
      type: 'QR',
      status: 'RECEIVED',
    });
    expect(first.body.data.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(first.body.data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Object.keys(first.body.data).sort()).toEqual([
      'code',
      'createdAt',
      'deviceId',
      'id',
      'status',
      'type',
    ]);

    expect(duplicate.status).toBe(400);
    expect(duplicate.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'This code already exists',
        details: [{ path: 'code', message: 'This code already exists' }],
      },
    });
    expect(await prisma.scan.count()).toBe(1);

    const after = await prisma.device.findUniqueOrThrow({ where: { deviceId: DEVICE_A } });
    expect(after.lastSeenAt.getTime()).toBeGreaterThan(before.lastSeenAt.getTime());
  });

  it('clears every row in the scan table and leaves devices in place', async () => {
    await registerDevice(DEVICE_A);
    await registerDevice(DEVICE_B, { platform: 'ios' });
    await submitScan(DEVICE_A, 'ONE', 'QR');
    await submitScan(DEVICE_B, 'TWO', 'BARCODE');

    const response = await request(app).delete('/api/v1/scans');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { deleted: 2 },
    });
    expect(await prisma.scan.count()).toBe(0);
    expect(await prisma.device.count()).toBe(2);

    const again = await submitScan(DEVICE_A, 'ONE', 'QR');
    expect(again.status).toBe(201);
  });

  it('creates a barcode scan', async () => {
    await registerDevice();

    const response = await submitScan(DEVICE_A, '123456789', 'BARCODE');

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        deviceId: DEVICE_A,
        code: '123456789',
        type: 'BARCODE',
        status: 'RECEIVED',
      },
    });
  });

  it('rejects a scan from a device that is not registered', async () => {
    const response = await submitScan(DEVICE_A, 'ABC123456', 'QR');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'DEVICE_NOT_FOUND',
        message: 'Device is not registered',
      },
    });
    expect(await prisma.scan.count()).toBe(0);
  });

  it('rejects an invalid scan type', async () => {
    await registerDevice();

    const response = await request(app).post('/api/v1/scans').send({
      deviceId: DEVICE_A,
      code: 'ABC123456',
      type: 'text',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'type', message: 'Type must be QR or BARCODE' }),
      ]),
    );
  });

  it('rejects an empty scan code', async () => {
    await registerDevice();

    const response = await request(app).post('/api/v1/scans').send({
      deviceId: DEVICE_A,
      code: '   ',
      type: 'QR',
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
      },
    });
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'code', message: 'Code cannot be empty' }),
      ]),
    );
  });

  it('returns an existing scan and 404 when it does not exist', async () => {
    await registerDevice();
    const created = await submitScan(DEVICE_A, 'LOOKUP', 'QR');

    const found = await request(app).get(`/api/v1/scans/${created.body.data.id}`);
    expect(found.status).toBe(200);
    expect(found.body).toEqual({
      success: true,
      data: created.body.data,
    });

    const missing = await request(app).get('/api/v1/scans/550e8400-e29b-41d4-a716-446655440000');
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({
      success: false,
      error: {
        code: 'SCAN_NOT_FOUND',
        message: 'Scan not found',
      },
    });

    const invalidId = await request(app).get('/api/v1/scans/not-a-uuid');
    expect(invalidId.status).toBe(400);
    expect(invalidId.body).toEqual({
      success: false,
      error: {
        code: 'INVALID_ID',
        message: 'Invalid scan id',
      },
    });
  });

  it('returns scan history from every device, newest first', async () => {
    const empty = await request(app).get('/api/v1/scans');
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({
      success: true,
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    });

    await registerDevice(DEVICE_A);
    await registerDevice(DEVICE_B, { platform: 'ios' });
    await submitScan(DEVICE_A, 'FIRST', 'QR');
    await delay(20);
    await submitScan(DEVICE_B, 'SECOND', 'BARCODE');

    const response = await request(app).get('/api/v1/scans');

    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    });
    expect(response.body.data.map((scan: { code: string }) => scan.code)).toEqual(['SECOND', 'FIRST']);
  });

  it('returns scan history for one device', async () => {
    await registerDevice(DEVICE_A);
    await registerDevice(DEVICE_B, { platform: 'ios' });
    await submitScan(DEVICE_A, 'A1', 'QR');
    await delay(20);
    await submitScan(DEVICE_B, 'B1', 'QR');
    await delay(20);
    await submitScan(DEVICE_A, 'A2', 'BARCODE');

    const response = await request(app).get(`/api/v1/devices/${DEVICE_A}/scans`);

    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    });
    expect(response.body.data.map((scan: { code: string; deviceId: string }) => ({
      code: scan.code,
      deviceId: scan.deviceId,
    }))).toEqual([
      { code: 'A2', deviceId: DEVICE_A },
      { code: 'A1', deviceId: DEVICE_A },
    ]);

    const missingDevice = await request(app).get(
      '/api/v1/devices/99999999-9999-4999-8999-999999999999/scans',
    );
    expect(missingDevice.status).toBe(404);
    expect(missingDevice.body.error.code).toBe('DEVICE_NOT_FOUND');
  });

  it('paginates scan history', async () => {
    await registerDevice();
    await submitScan(DEVICE_A, 'ONE', 'QR');
    await delay(20);
    await submitScan(DEVICE_A, 'TWO', 'QR');
    await delay(20);
    await submitScan(DEVICE_A, 'THREE', 'BARCODE');

    const response = await request(app).get('/api/v1/scans').query({ page: 2, limit: 2 });

    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].code).toBe('ONE');
  });

  it('returns a healthy response', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Server is healthy',
    });
  });

  it('returns 404 for an unknown route', async () => {
    const response = await request(app).get('/api/v1/unknown');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    });
  });
});
