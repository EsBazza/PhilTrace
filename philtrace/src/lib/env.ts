/**
 * Type-safe environment variable access.
 * All env vars are validated at import time.
 */

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOptionalEnvVar(name: string, defaultValue: string = ''): string {
  return process.env[name] ?? defaultValue;
}

/** Server-side only env vars */
export const env = {
  DATABASE_URL: () => getEnvVar('DATABASE_URL'),
  GEMINI_API_KEY: () => getEnvVar('GEMINI_API_KEY'),
  PSA_PSGC_TOKEN: () => getEnvVar('PSA_PSGC_TOKEN'),
  SEMAPHORE_API_KEY: () => getEnvVar('SEMAPHORE_API_KEY'),
  JWT_SECRET: () => getEnvVar('JWT_SECRET'),
  CRON_SECRET: () => getEnvVar('CRON_SECRET'),
  DEMO_OTP_BYPASS: () => getOptionalEnvVar('DEMO_OTP_BYPASS', 'false') === 'true',
} as const;
