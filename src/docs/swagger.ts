import { Express, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './openapi';

export function mountSwagger(app: Express): void {
  app.get('/api/docs/openapi.json', (_req: Request, res: Response) => {
    res.json(openApiSpec);
  });

  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: 'QR Scan API',
      swaggerOptions: {
        persistAuthorization: false,
        displayRequestDuration: true,
      },
    }),
  );
}
