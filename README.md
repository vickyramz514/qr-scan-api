# QR Scan API

Backend for a React Native app that scans QR codes and barcodes.

The phone creates its own `deviceId`, registers it, then sends each scanned value. This API stores devices and scans. It does not create device ids, and it does not include login or tokens.

A scanned code can be stored once. Submitting that code again returns a validation error until the scan table is cleared.

## Requirements

- Node.js 20 or newer
- PostgreSQL 14 or newer

## Project structure

```
src/
  config/
    env.ts
    database.ts
  controllers/
    device.controller.ts
    scan.controller.ts
  services/
    device.service.ts
    scan.service.ts
  repositories/
    device.repository.ts
    scan.repository.ts
  routes/
    device.routes.ts
    scan.routes.ts
    health.routes.ts
  validators/
    device.validator.ts
    scan.validator.ts
  docs/
    openapi.ts
    swagger.ts
  middleware/
    error.middleware.ts
    notFound.middleware.ts
  utils/
    apiResponse.ts
    asyncHandler.ts
    errors.ts
    logger.ts
  app.ts
  server.ts
prisma/
  schema.prisma
  migrations/
tests/
.env.example
```

Request flow:

```
Route → Controller → Zod validator → Service → Repository → Prisma → PostgreSQL
```

## API

Swagger UI for client testing: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

On Railway, open `https://YOUR_SERVICE_DOMAIN/api/docs`. The raw spec is at `/api/docs/openapi.json`.

Base path: `/api/v1`

### Health check

`GET /api/v1/health`

```json
{
  "success": true,
  "message": "Server is healthy"
}
```

Does not query the database.

### Register a device

`POST /api/v1/devices`

The mobile app supplies `deviceId`. The server never generates one. Calling this again with the same `deviceId` updates the device instead of inserting a second row.

```json
{
  "deviceId": "8f3a7c2e-91b4-4e2a-9f31",
  "platform": "android",
  "appVersion": "1.0.0"
}
```

| Field | Rules |
| --- | --- |
| `deviceId` | Required. 8 to 128 characters: letters, numbers, and hyphens. The app should store a UUID. |
| `platform` | Required. `android` or `ios`. |
| `appVersion` | Optional. When sent, it replaces the stored version. When omitted on an existing device, the stored version is left as it is. |

```json
{
  "success": true,
  "data": {
    "deviceId": "8f3a7c2e-91b4-4e2a-9f31",
    "platform": "android",
    "appVersion": "1.0.0",
    "createdAt": "2026-10-08T10:00:00.000Z",
    "lastSeenAt": "2026-10-08T10:00:00.000Z"
  }
}
```

### Submit a scan

`POST /api/v1/scans`

The device must already be registered. `lastSeenAt` is updated, then the scan is saved with status `RECEIVED`.

```json
{
  "deviceId": "8f3a7c2e-91b4-4e2a-9f31",
  "code": "ABC123456",
  "type": "QR"
}
```

| Field | Rules |
| --- | --- |
| `deviceId` | Required. Must match a registered device. |
| `code` | Required string. Trimmed. Empty values are rejected. Maximum length is 4096 characters. Must not already exist in the scan table. |
| `type` | `QR` or `BARCODE`. |

`201 Created`

```json
{
  "success": true,
  "data": {
    "id": "scan-uuid",
    "deviceId": "8f3a7c2e-91b4-4e2a-9f31",
    "code": "ABC123456",
    "type": "QR",
    "status": "RECEIVED",
    "createdAt": "2026-10-08T10:00:00.000Z"
  }
}
```

If that code is already stored, from this device or any other:

`400 Bad Request`

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "This code already exists",
    "details": [
      {
        "path": "code",
        "message": "This code already exists"
      }
    ]
  }
}
```

If the device is not registered:

```json
{
  "success": false,
  "error": {
    "code": "DEVICE_NOT_FOUND",
    "message": "Device is not registered"
  }
}
```

### Scan history

`GET /api/v1/scans?page=1&limit=20`

Returns scans from every device, newest first. `page` defaults to 1. `limit` defaults to 20 and cannot be higher than 100.

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

### Device scan history

`GET /api/v1/devices/:deviceId/scans?page=1&limit=20`

Returns scans for that device only, newest first. An unknown device returns `DEVICE_NOT_FOUND`.

### Clear scans

`DELETE /api/v1/scans`

Deletes every row in the scan table. Devices are not deleted. After this, a code that was rejected as a duplicate can be submitted again.

```json
{
  "success": true,
  "data": {
    "deleted": 2
  }
}
```

### Clear scans

`DELETE /api/v1/scans`

Deletes every row in the scan table. Devices are not deleted. After this, a code that was rejected as a duplicate can be submitted again.

```json
{
  "success": true,
  "data": {
    "deleted": 2
  }
}
```

### Get one scan

`GET /api/v1/scans/:id`

Unknown scan:

```json
{
  "success": false,
  "error": {
    "code": "SCAN_NOT_FOUND",
    "message": "Scan not found"
  }
}
```

### Errors

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request"
  }
}
```

| Situation | HTTP | `error.code` |
| --- | --- | --- |
| Invalid body or query | 400 | `VALIDATION_ERROR` |
| Invalid device id in a path | 400 | `INVALID_DEVICE_ID` |
| Malformed scan UUID | 400 | `INVALID_ID` |
| Malformed JSON | 400 | `INVALID_JSON` |
| Body larger than 32 KB | 413 | `PAYLOAD_TOO_LARGE` |
| Device is not registered | 404 | `DEVICE_NOT_FOUND` |
| Scan does not exist | 404 | `SCAN_NOT_FOUND` |
| Unknown route | 404 | `NOT_FOUND` |
| Too many requests | 429 | `RATE_LIMITED` |
| Database failure | 500 | `DATABASE_ERROR` |
| Unexpected failure | 500 | `INTERNAL_ERROR` |

Validation responses include `error.details`. Production responses do not include stack traces or database internals.

## React Native

Do not send a hardware id. Generate a random UUID once, keep it in AsyncStorage, and send that value as `deviceId`.

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://YOUR_COMPUTER_LAN_IP:3000';
const DEVICE_ID_KEY = 'deviceId';

async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const deviceId = crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

async function registerDevice(platform: 'android' | 'ios', appVersion: string) {
  const deviceId = await getOrCreateDeviceId();

  const response = await fetch(`${API_BASE_URL}/api/v1/devices`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deviceId,
      platform,
      appVersion,
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message ?? 'Device registration failed');
  }

  return deviceId;
}

async function submitScan(deviceId: string, code: string, type: 'QR' | 'BARCODE') {
  const response = await fetch(`${API_BASE_URL}/api/v1/scans`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deviceId,
      code,
      type,
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message ?? 'Scan submission failed');
  }

  return body.data;
}
```

Startup:

1. Read `deviceId` from AsyncStorage.
2. If it is missing, generate a UUID and save it.
3. Call `POST /api/v1/devices` with that id, `platform`, and `appVersion`.
4. Keep using the same id for later launches. Register again on launch so `platform`, `appVersion`, and `lastSeenAt` stay current.

After a successful scan:

```ts
const type = event.type === 'qr' ? 'QR' : 'BARCODE';
await submitScan(deviceId, event.value, type);
```

`QR` is only for QR symbols. Every other barcode (EAN, UPC, Code 128, and so on) is `BARCODE`.

No `Authorization` header is required.

Use the computer's LAN address for a physical phone. Android emulator: `http://10.0.2.2:3000`. iOS simulator: `http://localhost:3000`.

### Duplicate codes

The camera can read the same symbol several times. Submit the first read. If `POST /api/v1/scans` returns `VALIDATION_ERROR` with message `This code already exists`, do not store another row. Clearing the list calls `DELETE /api/v1/scans`, which removes every scan. The same code can be scanned again after that.

### Offline

Offline sync is not implemented. Submit a scan when the device has a network connection.

The scan response includes `id`, `deviceId`, and `createdAt`. A later offline queue can store those fields locally and sync when connectivity returns. The current API does not accept a client-generated scan id or a queued timestamp.

## Database setup

1. Create the databases. This creates empty databases only. Prisma owns the tables.

```bash
createdb qr_scan
createdb qr_scan_test
```

`qr_scan` is for local development. `qr_scan_test` is for the API tests.

2. Configure `DATABASE_URL`.

```bash
cp .env.example .env
```

Homebrew PostgreSQL with peer authentication:

```
DATABASE_URL=postgresql://YOUR_OS_USER@localhost:5432/qr_scan
```

With a password:

```
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/qr_scan
```

3. Create and apply the migration.

```bash
npm run prisma:migrate
```

Use the migration name `init_devices_and_scans` the first time Prisma asks. That creates `Device`, `Scan`, the scan enums, the foreign key from `Scan.deviceId` to `Device.deviceId` with `ON DELETE CASCADE`, and the indexes.

Apply the same migration to the test database:

```bash
DATABASE_URL=postgresql://YOUR_OS_USER@localhost:5432/qr_scan_test npx prisma migrate deploy
```

4. Generate the Prisma client.

```bash
npm run prisma:generate
```

`npm run prisma:migrate` also generates the client. Run the generate script on its own after a clean install.

5. Start the API.

```bash
npm run dev
```

6. Try it.

```bash
curl http://localhost:3000/api/v1/health

curl -X POST http://localhost:3000/api/v1/devices \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"8f3a7c2e-91b4-4e2a-9f31","platform":"android","appVersion":"1.0.0"}'

curl -X POST http://localhost:3000/api/v1/scans \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"8f3a7c2e-91b4-4e2a-9f31","code":"ABC123456","type":"QR"}'

curl 'http://localhost:3000/api/v1/scans?page=1&limit=20'
curl 'http://localhost:3000/api/v1/devices/8f3a7c2e-91b4-4e2a-9f31/scans?page=1&limit=20'
```

## Environment

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port. Default `3000`. |
| `NODE_ENV` | `development`, `test`, or `production`. |
| `DATABASE_URL` | PostgreSQL connection string. Required. |
| `CORS_ORIGIN` | `*` allows any browser origin. A comma-separated list allows those origins. Empty disables cross-origin browser access. React Native does not use CORS. |
| `RATE_LIMIT_WINDOW_MS` | Rate-limit window. Default 15 minutes. |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per IP per window. Health checks are excluded. |

The process exits on startup when required variables are missing or invalid. `.env` is not committed.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start with reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |
| `npm test` | API tests against `qr_scan_test` |
| `npm run lint` | ESLint |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Create and apply a development migration |
| `npm run prisma:studio` | Open Prisma Studio |

Tests use `qr_scan_test` on localhost unless `TEST_DATABASE_URL` is set.

## Production

```bash
npm ci
npm run build
npx prisma migrate deploy
npm start
```

PM2, one process:

```bash
pm2 start dist/server.js --name qr-scan-api
pm2 save
```

The rate limiter keeps counts in memory. Do not run multiple instances until a shared store is added.

Nginx:

```nginx
server {
  listen 80;
  server_name api.example.com;

  client_max_body_size 32k;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

The app trusts one proxy hop so the rate limiter sees the client address. Set `NODE_ENV=production`, a real `DATABASE_URL`, and an explicit `CORS_ORIGIN`. Logs are JSON and do not include request bodies.
