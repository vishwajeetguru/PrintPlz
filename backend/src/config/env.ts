import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  CLIENT_URL: process.env.CLIENT_URL ?? 'http://localhost:5173',
  DATABASE_URL: required('DATABASE_URL', 'postgresql://printplz:printplz@localhost:5432/printplz?schema=public'),
  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me-32chars!!'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me-32chars!'),
  JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL ?? '15m',
  JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL ?? '30d',
  DEV_OTP_CODE: process.env.DEV_OTP_CODE ?? '123456',
  OTP_TTL_MINUTES: Number(process.env.OTP_TTL_MINUTES ?? 5),
  SUPERADMIN_PHONE: process.env.SUPERADMIN_PHONE ?? '+919000000000',
  SUPERADMIN_PASSWORD: process.env.SUPERADMIN_PASSWORD ?? 'Super@123',
  SUPERADMIN_NAME: process.env.SUPERADMIN_NAME ?? 'PrintPlz Admin',
  PRICE_BW_PER_PAGE: Number(process.env.PRICE_BW_PER_PAGE ?? 2),
  PRICE_COLOR_PER_PAGE: Number(process.env.PRICE_COLOR_PER_PAGE ?? 10),
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? 'uploads',
  MAX_FILE_MB: Number(process.env.MAX_FILE_MB ?? 15),
};
