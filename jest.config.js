/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFiles: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Disable TS type-checking during test runs — TSC handles that separately
  globals: {
    'ts-jest': {
      diagnostics: false,
    },
  },
  forceExit: true,
};
