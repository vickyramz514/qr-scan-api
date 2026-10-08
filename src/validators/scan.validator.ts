import { z } from 'zod';
import { deviceIdSchema } from './device.validator';

export const MAX_CODE_LENGTH = 4096;
export const MAX_PAGE_LIMIT = 100;

export const createScanSchema = z.object({
  deviceId: deviceIdSchema,
  code: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z
      .string({
        required_error: 'Code is required',
        invalid_type_error: 'Code must be a string',
      })
      .min(1, 'Code cannot be empty')
      .max(MAX_CODE_LENGTH, `Code must be at most ${MAX_CODE_LENGTH} characters`),
  ),
  type: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
    z.enum(['QR', 'BARCODE'], {
      errorMap: () => ({ message: 'Type must be QR or BARCODE' }),
    }),
  ),
});

export const listScansQuerySchema = z.object({
  page: z.preprocess(
    (value) => (value === undefined || value === '' ? 1 : value),
    z.coerce
      .number({ invalid_type_error: 'Page must be a positive integer' })
      .int('Page must be a positive integer')
      .min(1, 'Page must be a positive integer'),
  ),
  limit: z.preprocess(
    (value) => (value === undefined || value === '' ? 20 : value),
    z.coerce
      .number({ invalid_type_error: 'Limit must be a positive integer' })
      .int('Limit must be a positive integer')
      .min(1, 'Limit must be between 1 and 100')
      .max(MAX_PAGE_LIMIT, 'Limit must be between 1 and 100'),
  ),
});

export const scanIdSchema = z.string().uuid();

export type CreateScanInput = z.infer<typeof createScanSchema>;
export type ListScansQuery = z.infer<typeof listScansQuerySchema>;
