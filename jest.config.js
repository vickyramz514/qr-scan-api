/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
  testTimeout: 20000,
  clearMocks: true,
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          strict: true,
          types: ['node', 'jest'],
          exactOptionalPropertyTypes: true,
        },
      },
    ],
  },
};
