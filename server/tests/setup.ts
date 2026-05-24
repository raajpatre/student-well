// Vitest setup file.
//
// Stubs the required env vars so that importing any module which
// transitively pulls in config/env.ts (which fails fast on missing keys)
// or lib/supabase.ts (which validates the URL shape) doesn't blow up the
// test process. None of the current tests hit the network or the DB —
// these stubs only exist to satisfy the module-load contract.

const defaults: Record<string, string> = {
  NODE_ENV: 'test',
  CLIENT_URL: 'http://localhost:5173',
  SUPABASE_URL: 'https://stub.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'stub-service-role-key',
  GEMINI_API_KEY: 'stub-gemini-key',
  // 64 hex chars = 32 bytes, matches the ENCRYPTION_KEY format.
  ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  JWT_SECRET: 'stub-jwt-secret',
};

for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) process.env[key] = value;
}
