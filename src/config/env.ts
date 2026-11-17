import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  ADMIN_API_TOKEN: z.string().min(32).optional(),
  CORS_ORIGIN: z.string().default(''),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  LOCATION_MIN_MOVE_METERS: z.coerce.number().positive().default(25),
  LOCATION_MIN_INTERVAL_MS: z.coerce.number().int().positive().default(20_000),
}).superRefine((config, context) => {
  if (config.NODE_ENV === 'production' && !config.ADMIN_API_TOKEN) {
    context.addIssue({ code: 'custom', path: ['ADMIN_API_TOKEN'], message: 'ADMIN_API_TOKEN is required in production' });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${details}`);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';

export function getCorsOrigin(): boolean | string | string[] {
  const value = env.CORS_ORIGIN.trim();

  if (value === '*') {
    return '*';
  }

  if (value.length === 0) {
    return false;
  }

  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return origins.length > 0 ? origins : false;
}
