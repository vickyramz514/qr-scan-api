process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.CORS_ORIGIN = '*';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.RATE_LIMIT_MAX_REQUESTS = '10000';

const databaseUser = process.env.USER || 'postgres';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  `postgresql://${databaseUser}@localhost:5432/qr_scan_test?schema=public`;
