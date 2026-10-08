import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env, getCorsOrigin } from './config/env';
import { errorMiddleware } from './middleware/error.middleware';
import { notFoundMiddleware } from './middleware/notFound.middleware';
import { deviceRouter } from './routes/device.routes';
import { healthRouter } from './routes/health.routes';
import { scanRouter } from './routes/scan.routes';
import { logger } from './utils/logger';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: getCorsOrigin(),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
    maxAge: 600,
  }),
);

app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/api/v1/health',
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
app.use('/api/v1/devices', deviceRouter);
app.use('/api/v1/scans', scanRouter);
app.use(notFoundMiddleware);
app.use(errorMiddleware);
