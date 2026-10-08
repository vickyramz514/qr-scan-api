export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'QR Scan API',
    version: '1.0.0',
    description:
      'Backend for a React Native QR and barcode scanner. The app creates its own deviceId, registers the device, then submits each scan. There is no login.',
  },
  servers: [
    {
      url: '/',
      description: 'This server',
    },
  ],
  tags: [
    { name: 'Health', description: 'Service status' },
    { name: 'Devices', description: 'Device registration and device scan history' },
    { name: 'Scans', description: 'Submit, list, fetch, and clear scans' },
  ],
  paths: {
    '/api/v1/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'Server is running. This does not query the database.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
                example: {
                  success: true,
                  message: 'Server is healthy',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/devices': {
      post: {
        tags: ['Devices'],
        summary: 'Register or update a device',
        description:
          'Idempotent. The mobile app supplies deviceId. The same deviceId updates platform, appVersion, and lastSeenAt instead of creating a second row. Omitting appVersion on an existing device leaves the stored version unchanged.',
        operationId: 'registerDevice',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterDeviceRequest' },
              example: {
                deviceId: '8f3a7c2e-91b4-4e2a-9f31',
                platform: 'android',
                appVersion: '1.0.0',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Device created or updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DeviceResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
        },
      },
    },
    '/api/v1/devices/{deviceId}/scans': {
      get: {
        tags: ['Devices'],
        summary: 'List scans for one device',
        operationId: 'listDeviceScans',
        parameters: [
          { $ref: '#/components/parameters/deviceId' },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          '200': {
            description: 'Newest scans for this device first',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ScanListResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/InvalidDeviceId' },
          '404': { $ref: '#/components/responses/DeviceNotFound' },
        },
      },
    },
    '/api/v1/scans': {
      post: {
        tags: ['Scans'],
        summary: 'Submit a scan',
        description:
          'The device must already be registered. A new scan is stored with status RECEIVED. The same code cannot be stored twice until the scan table is cleared.',
        operationId: 'createScan',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateScanRequest' },
              examples: {
                qr: {
                  summary: 'QR code',
                  value: {
                    deviceId: '8f3a7c2e-91b4-4e2a-9f31',
                    code: 'ABC123456',
                    type: 'QR',
                  },
                },
                barcode: {
                  summary: 'Barcode',
                  value: {
                    deviceId: '8f3a7c2e-91b4-4e2a-9f31',
                    code: '123456789',
                    type: 'BARCODE',
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Scan stored',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ScanResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '404': { $ref: '#/components/responses/DeviceNotFound' },
        },
      },
      get: {
        tags: ['Scans'],
        summary: 'List scans from every device',
        operationId: 'listScans',
        parameters: [{ $ref: '#/components/parameters/page' }, { $ref: '#/components/parameters/limit' }],
        responses: {
          '200': {
            description: 'Newest scans first',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ScanListResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
        },
      },
      delete: {
        tags: ['Scans'],
        summary: 'Clear every scan',
        description:
          'Deletes every row in the scan table. Devices stay registered. After this, a code that was rejected as a duplicate can be submitted again.',
        operationId: 'clearScans',
        responses: {
          '200': {
            description: 'Scan rows deleted',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ClearScansResponse' },
                example: {
                  success: true,
                  data: { deleted: 2 },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/scans/{id}': {
      get: {
        tags: ['Scans'],
        summary: 'Get one scan',
        operationId: 'getScan',
        parameters: [{ $ref: '#/components/parameters/scanId' }],
        responses: {
          '200': {
            description: 'Scan found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ScanResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/InvalidScanId' },
          '404': { $ref: '#/components/responses/ScanNotFound' },
        },
      },
    },
  },
  components: {
    parameters: {
      deviceId: {
        name: 'deviceId',
        in: 'path',
        required: true,
        description: 'Client-generated device id. 8 to 128 letters, numbers, or hyphens.',
        schema: { type: 'string', example: '8f3a7c2e-91b4-4e2a-9f31' },
      },
      scanId: {
        name: 'id',
        in: 'path',
        required: true,
        description: 'Scan UUID returned by POST /api/v1/scans.',
        schema: { type: 'string', format: 'uuid' },
      },
      page: {
        name: 'page',
        in: 'query',
        required: false,
        schema: { type: 'integer', minimum: 1, default: 1 },
      },
      limit: {
        name: 'limit',
        in: 'query',
        required: false,
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
    },
    responses: {
      ValidationError: {
        description: 'Invalid request body or query',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid request',
                details: [{ path: 'code', message: 'Code cannot be empty' }],
              },
            },
          },
        },
      },
      DeviceNotFound: {
        description: 'Device is not registered',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: {
                code: 'DEVICE_NOT_FOUND',
                message: 'Device is not registered',
              },
            },
          },
        },
      },
      ScanNotFound: {
        description: 'Scan does not exist',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: {
                code: 'SCAN_NOT_FOUND',
                message: 'Scan not found',
              },
            },
          },
        },
      },
      InvalidScanId: {
        description: 'Scan id is not a UUID',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: {
                code: 'INVALID_ID',
                message: 'Invalid scan id',
              },
            },
          },
        },
      },
      InvalidDeviceId: {
        description: 'Device id in the path is invalid',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: {
                code: 'INVALID_DEVICE_ID',
                message: 'Invalid device id',
              },
            },
          },
        },
      },
    },
    schemas: {
      HealthResponse: {
        type: 'object',
        required: ['success', 'message'],
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Server is healthy' },
        },
      },
      RegisterDeviceRequest: {
        type: 'object',
        required: ['deviceId', 'platform'],
        properties: {
          deviceId: {
            type: 'string',
            minLength: 8,
            maxLength: 128,
            example: '8f3a7c2e-91b4-4e2a-9f31',
          },
          platform: { type: 'string', enum: ['android', 'ios'], example: 'android' },
          appVersion: { type: 'string', maxLength: 32, example: '1.0.0' },
        },
      },
      Device: {
        type: 'object',
        required: ['deviceId', 'platform', 'appVersion', 'createdAt', 'lastSeenAt'],
        properties: {
          deviceId: { type: 'string', example: '8f3a7c2e-91b4-4e2a-9f31' },
          platform: { type: 'string', example: 'android' },
          appVersion: { type: 'string', nullable: true, example: '1.0.0' },
          createdAt: { type: 'string', format: 'date-time' },
          lastSeenAt: { type: 'string', format: 'date-time' },
        },
      },
      DeviceResponse: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/Device' },
        },
      },
      CreateScanRequest: {
        type: 'object',
        required: ['deviceId', 'code', 'type'],
        properties: {
          deviceId: { type: 'string', example: '8f3a7c2e-91b4-4e2a-9f31' },
          code: { type: 'string', minLength: 1, maxLength: 4096, example: 'ABC123456' },
          type: { type: 'string', enum: ['QR', 'BARCODE'], example: 'QR' },
        },
      },
      Scan: {
        type: 'object',
        required: ['id', 'deviceId', 'code', 'type', 'status', 'createdAt'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          deviceId: { type: 'string' },
          code: { type: 'string' },
          type: { type: 'string', enum: ['QR', 'BARCODE'] },
          status: { type: 'string', enum: ['RECEIVED', 'VALID', 'INVALID'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ScanResponse: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/Scan' },
        },
      },
      Pagination: {
        type: 'object',
        required: ['page', 'limit', 'total', 'totalPages'],
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 0 },
          totalPages: { type: 'integer', example: 0 },
        },
      },
      ScanListResponse: {
        type: 'object',
        required: ['success', 'data', 'pagination'],
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Scan' },
          },
          pagination: { $ref: '#/components/schemas/Pagination' },
        },
      },
      ClearScansResponse: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            required: ['deleted'],
            properties: {
              deleted: { type: 'integer', example: 2 },
            },
          },
        },
      },
      ErrorBody: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          message: { type: 'string', example: 'Invalid request' },
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['success', 'error'],
        properties: {
          success: { type: 'boolean', example: false },
          error: { $ref: '#/components/schemas/ErrorBody' },
        },
      },
    },
  },
} as const;
