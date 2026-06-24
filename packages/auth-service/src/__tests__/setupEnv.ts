// Ensure deterministic test environment for the auth service.
process.env.NODE_ENV = 'test';
process.env.INTERNAL_SERVICE_SECRET = 'nm-jwt-secret-2026';
