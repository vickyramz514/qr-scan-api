import { app } from './app';
import { prisma } from './config/database';
import { env } from './config/env';
import { logger } from './utils/logger';

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server started');
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down');

  server.close(() => {
    prisma
      .$disconnect()
      .catch((err: unknown) => {
        logger.error({ err }, 'Failed to disconnect from the database');
      })
      .finally(() => {
        process.exit(0);
      });
  });
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  shutdown('SIGINT');
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error({ err: reason }, 'Unhandled rejection');
});
