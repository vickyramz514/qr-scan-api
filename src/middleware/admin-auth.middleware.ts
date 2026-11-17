import { timingSafeEqual } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';

function tokenMatches(candidate: string, expected: string): boolean {
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const expectedToken = env.ADMIN_API_TOKEN;
  if (!expectedToken) {
    res.status(503).json({ success: false, error: { code: 'ADMIN_AUTH_NOT_CONFIGURED', message: 'Admin authentication is not configured' } });
    return;
  }

  const authorization = req.header('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match || !tokenMatches(match[1] ?? '', expectedToken)) {
    res.set('WWW-Authenticate', 'Bearer');
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Valid admin bearer token required' } });
    return;
  }

  next();
}
