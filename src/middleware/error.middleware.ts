import { Prisma } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

function readStatus(err: object): number | undefined {
  if (!('status' in err)) {
    return undefined;
  }

  const status = (err as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    const error: { code: string; message: string; details?: unknown } = {
      code: err.code,
      message: err.message,
    };

    if (err.details !== undefined) {
      error.details = err.details;
    }

    res.status(err.statusCode).json({
      success: false,
      error,
    });
    return;
  }

  if (err instanceof SyntaxError && readStatus(err) === 400) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON body',
      },
    });
    return;
  }

  if (typeof err === 'object' && err !== null && readStatus(err) === 413) {
    res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request body is too large',
      },
    });
    return;
  }

  if (
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientValidationError ||
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError
  ) {
    logger.error({ err }, 'Database error');
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'A database error occurred',
      },
    });
    return;
  }

  logger.error({ err }, 'Unexpected error');
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
