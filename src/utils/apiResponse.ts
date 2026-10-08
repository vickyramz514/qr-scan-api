import { Response } from 'express';

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ErrorBody = {
  code: string;
  message: string;
  details?: unknown;
};

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    data,
  });
}

export function sendMessage(res: Response, message: string, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    message,
  });
}

export function sendPaginated<T>(res: Response, data: T[], pagination: Pagination): void {
  res.status(200).json({
    success: true,
    data,
    pagination,
  });
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  const error: ErrorBody = { code, message };

  if (details !== undefined) {
    error.details = details;
  }

  res.status(statusCode).json({
    success: false,
    error,
  });
}
