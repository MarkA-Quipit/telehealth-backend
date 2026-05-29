// Provide required environment variables before any module loads
process.env.JWT_SECRET = 'test-jwt-secret-for-tests-only';
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
process.env.PUSHER_APP_ID = 'test-app-id';
process.env.PUSHER_KEY = 'test-key';
process.env.PUSHER_SECRET = 'test-secret';
process.env.PUSHER_CLUSTER = 'us2';
