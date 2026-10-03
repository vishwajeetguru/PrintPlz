import { env } from '../config/env';

export function makeOtp(): string {
  // In dev, always return the fixed code so mobile demo (123456) works.
  if (env.DEV_OTP_CODE) return env.DEV_OTP_CODE;
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function otpExpiry(): Date {
  return new Date(Date.now() + env.OTP_TTL_MINUTES * 60 * 1000);
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s-]/g, '');
}
