import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env, isCorsOriginAllowed } from './config/env';
import { mountSwagger } from './docs/swagger';
import { errorMiddleware } from './middleware/error.middleware';
import { notFoundMiddleware } from './middleware/notFound.middleware';
import { deliveryRouter } from './routes/delivery.routes';
import { adminRouter } from './routes/admin.routes';
import { deviceRouter, mobileDeviceRegistrationRouter } from './routes/device.routes';
import { geofenceRouter } from './routes/geofence.routes';
import { healthRouter } from './routes/health.routes';
import { locationRouter } from './routes/location.routes';
import { officeRouter } from './routes/office.routes';
import { scanRouter } from './routes/scan.routes';
import { logger } from './utils/logger';

export const app = express();

app.disable('x-powered-by');
app.set('etag', false);
app.set('trust proxy', 1);

const apiHelmet = helmet();
const docsHelmet = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
});

app.use((req, res, next) => {
  if (req.path === '/api/docs' || req.path.startsWith('/api/docs/')) {
    docsHelmet(req, res, next);
    return;
  }

  apiHelmet(req, res, next);
});
const corsOptions = {
  origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (isCorsOriginAllowed(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Accept',
    'Authorization',
    'Idempotency-Key',
    'X-Device-Id',
    'X-Requested-With',
  ],
  credentials: true,
  maxAge: 600,
};

// Explicitly terminate browser preflights before rate limiting and route lookup.
app.options(/.*/, cors(corsOptions));
app.use(cors(corsOptions));
app.use('/api/admin', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health' || req.path === '/api/v1/health' || req.path.startsWith('/api/docs'),
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
        },
      });
    },
  }),
);

app.use(express.json({ limit: '32kb' }));

app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    if (env.NODE_ENV === 'test') {
      return;
    }

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const path = req.originalUrl.split('?')[0] ?? req.path;

    logger.info(
      {
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs),
      },
      'request completed',
    );
  });

  next();
});

app.use('/api/v1/health', healthRouter);
app.use('/health', healthRouter);
app.use('/api/devices', mobileDeviceRegistrationRouter);
app.use('/api/admin', adminRouter);
app.use('/api/v1/devices', deviceRouter);
app.use('/api/v1/scans', scanRouter);
app.use('/api/locations', locationRouter);
app.use('/api/v1/locations', locationRouter);
app.use('/api/office', officeRouter);
app.use('/api/geofence-events', geofenceRouter);
app.use('/api/v1/geofence-events', geofenceRouter);
app.use('/api/deliveries', deliveryRouter);
app.use('/api/v1/deliveries', deliveryRouter);
mountSwagger(app);
app.use(notFoundMiddleware);
app.use(errorMiddleware);
