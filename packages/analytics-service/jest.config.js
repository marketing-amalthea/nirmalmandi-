/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: { module: 'commonjs', esModuleInterop: true, strict: false },
    }],
  },
  moduleNameMapper: {
    '^@nirmalmandi/shared$': '<rootDir>/../shared/src/index.ts',
  },
  setupFiles: ['<rootDir>/src/__tests__/setupEnv.ts'],
  verbose: true,
};
